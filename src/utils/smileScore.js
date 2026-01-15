export const calculateSmileScore = (blendshapes) => {
  const get = (name) =>
    blendshapes.find((b) => b.categoryName === name)?.score || 0;

  const mouth = (get("mouthSmileLeft") + get("mouthSmileRight")) / 2;

  const eyes = (get("eyeSquintLeft") + get("eyeSquintRight")) / 2;

  // Weighted score (real smile = mouth + eyes)
  const raw = mouth * 0.7 + eyes * 0.3;

  return Math.min(100, Math.round(raw * 100));
};

export const smoothScore = (prev, next, alpha = 0.25) => {
  return Math.round(prev * (1 - alpha) + next * alpha);
};
