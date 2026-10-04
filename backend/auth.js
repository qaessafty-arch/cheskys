import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be set in environment variables');
}

/**
 * User registers
 * 1. Hash password with bcrypt (salt rounds: 12)
 * 2. Insert into PostgreSQL
 * 3. Return user ID (initial ELO: 1200)
 */
export async function registerUser(username, email, password, db) {
  // 1. Hash password with bcrypt (salt rounds: 12)
  const hashedPassword = await bcrypt.hash(password, 12);

  // 2. Insert into PostgreSQL
  const result = await db.query(
    'INSERT INTO users (username, email, password_hash, elo_rating) VALUES ($1, $2, $3, 1200) RETURNING id',
    [username, email, hashedPassword]
  );

  // 3. Return user ID (initial ELO: 1200)
  return result.rows[0].id;
}

/**
 * User logs in
 * 1. Find user by email
 * 2. Verify password
 * 3. Generate JWT (access token: 15min, refresh token: 7days)
 * 4. Store refresh token in Redis (invalidate on logout)
 */
export async function loginUser(email, password, db, redis) {
  // 1. Find user by email
  const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = result.rows[0];
  if (!user) throw new Error('Invalid credentials');

  // 2. Verify password
  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) throw new Error('Invalid credentials');

  // 3. Generate JWT (access token: 15min, refresh token: 7days)
  const accessToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId: user.id, tokenId: crypto.randomUUID() }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

  // 4. Store refresh token in Redis (invalidate on logout)
  if (redis) {
    if (typeof redis.setex === 'function') {
      await redis.setex(`refresh:${user.id}`, 604800, refreshToken);
    } else if (typeof redis.set === 'function') {
      await redis.set(`refresh:${user.id}`, refreshToken, 'EX', 604800);
    }
  }

  // Sanitize user object
  delete user.password_hash;

  return { accessToken, refreshToken, user };
}

/**
 * Rotate refresh token - issue new one, invalidate old one
 */
export async function rotateRefreshToken(refreshToken, db, redis) {
  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);

    // Check if token is blacklisted
    const isBlacklisted = await redis.get(`blacklist:${refreshToken}`);
    if (isBlacklisted) {
      throw new Error('Token revoked');
    }

    // Verify Redis token store if available
    if (redis) {
      const stored = await redis.get(`refresh:${decoded.userId}`);
      if (!stored || stored !== refreshToken) {
        throw new Error('Refresh token revoked or rotated');
      }
    }

    // Blacklist old token
    await redis.setex(`blacklist:${refreshToken}`, 604800, '1');

    // Generate new token pair
    const newAccessToken = jwt.sign({ userId: decoded.userId }, JWT_SECRET, { expiresIn: '15m' });
    const newRefreshToken = jwt.sign({
      userId: decoded.userId,
      tokenId: crypto.randomUUID()
    }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

    // Store new refresh token
    if (redis) {
      await redis.setex(`refresh:${decoded.userId}`, 604800, newRefreshToken);
    }

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  } catch (err) {
    throw new Error('Token rotation failed: ' + err.message);
  }
}

// Set httpOnly cookie for refresh token
export function setRefreshTokenCookie(res, refreshToken) {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/'
  });
}

// Clear refresh token cookie
export function clearRefreshTokenCookie(res) {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });
}

/**
 * Invalidate refresh token in Redis on logout
 */
export async function logoutUser(userId, redis) {
  if (redis && typeof redis.del === 'function') {
    await redis.del(`refresh:${userId}`);
  }
  return true;
}

/**
 * Express Middleware: Validate JWT Access Token
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = decoded;
    next();
  });
}

/**
 * Socket.IO middleware - authenticate on connection
 */
export function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.userId || decoded.id;
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
}
