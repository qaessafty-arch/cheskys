import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useSettings } from '../context/SettingsContext';

export const AmbientBackground: React.FC = () => {
  const { customBackground } = useSettings();
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [customBackground.imageUrl]);

  const isHighContrast = customBackground.mode === 'high_contrast';
  const isCustomImage = customBackground.mode === 'image' && customBackground.imageUrl && !imageFailed;
  const isCustomGradient = customBackground.mode === 'gradient';
  const isCustomColor = customBackground.mode === 'color';

  return (
    <>
      {/* Custom Wallpaper Layer if user selected an image */}
      {isCustomImage && (
        <>
          <div
            className="custom-bg-layer"
            style={{
              backgroundImage: `url("${customBackground.imageUrl}")`,
              opacity: customBackground.imageOpacity ?? 0.65,
              filter: customBackground.blur ? `blur(${customBackground.blur}px)` : undefined,
            }}
          >
            {/* Hidden image element to detect load error and fail gracefully */}
            <img
              src={customBackground.imageUrl}
              alt=""
              className="hidden"
              onError={() => setImageFailed(true)}
              referrerPolicy="no-referrer"
            />
          </div>
          {/* Readability Shield: protects glassmorphism panels against bright/cluttered photos */}
          <div className="custom-bg-shield" />
        </>
      )}

      {/* Custom Gradient Layer */}
      {isCustomGradient && (
        <div
          className="custom-bg-layer"
          style={{
            background: `linear-gradient(${customBackground.gradientAngle ?? 135}deg, ${
              customBackground.gradientStart || '#0f172a'
            }, ${customBackground.gradientEnd || '#1e1b4b'})`,
            opacity: 1,
          }}
        />
      )}

      {/* Custom Solid Color Layer */}
      {isCustomColor && (
        <div
          className="custom-bg-layer"
          style={{
            backgroundColor: customBackground.color || '#05070a',
            opacity: 1,
          }}
        />
      )}

      {/* High Contrast Background Layer */}
      {isHighContrast && (
        <div
          className="custom-bg-layer"
          style={{
            backgroundColor: '#080C14',
            opacity: 1,
          }}
        />
      )}

      {/* Cinematic Base Layers (suppressed in High Contrast to maximize visual clarity) */}
      {!isHighContrast && <div className="bg-grain" />}
      {!isHighContrast && <div className="bg-vignette" />}
      
      {/* Ambient Mesh Spheres (rendered only for normal themes or subtle tint) */}
      {!isHighContrast && (
        <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden select-none [contain:strict]">
          {/* Mesh 1 Ambient Gradient Sphere */}
          <div
            className="ambient-sphere w-[750px] h-[750px]"
            style={{
              top: '-12%',
              left: '-8%',
              background: 'radial-gradient(circle, var(--mesh-1) 0%, transparent 68%)',
            }}
          />

          {/* Mesh 2 Ambient Gradient Sphere */}
          <div
            className="ambient-sphere w-[600px] h-[600px]"
            style={{
              top: '25%',
              right: '-10%',
              background: 'radial-gradient(circle, var(--mesh-2) 0%, transparent 65%)',
            }}
          />

          {/* Mesh 3 Ambient Gradient Sphere */}
          <div
            className="ambient-sphere w-[550px] h-[550px]"
            style={{
              bottom: '-10%',
              left: '18%',
              background: 'radial-gradient(circle, var(--mesh-3) 0%, transparent 65%)',
            }}
          />
        </div>
      )}
    </>
  );
};

