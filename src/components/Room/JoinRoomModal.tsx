const handleJoinCode = async (targetCode: string) => {
  const cleanCode = targetCode.trim().toUpperCase();
  if (cleanCode.length < 3) {
    setError('Room code must be at least 3 characters.');
    return;
  }

  setJoining(true);
  setError(null);
  try {
    // FIX: Use joinRoomWithContext instead of joinRoom
    await room.joinRoomWithContext(cleanCode);
    onJoined?.(cleanCode);
    onClose();
  } catch (err: any) {
    setError(err?.message || 'Could not join room.');
  } finally {
    setJoining(false);
  }
};
