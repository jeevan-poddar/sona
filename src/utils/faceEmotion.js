export const detectEmotion = (blendshapes) => {
  const get = (name) =>
    blendshapes.find((b) => b.categoryName === name)?.score || 0;

  const smile = (get("mouthSmileLeft") + get("mouthSmileRight")) / 2;
  const eyeSquint = (get("eyeSquintLeft") + get("eyeSquintRight")) / 2;
  const pucker = get("mouthPucker");
  const jawOpen = get("jawOpen");
  const browDown = (get("browDownLeft") + get("browDownRight")) / 2;

  if (smile > 0.5 && eyeSquint > 0.3) return "happy";
  if (pucker > 0.6) return "kiss";
  if (jawOpen > 0.6) return "surprised";
  if (browDown > 0.4 && smile < 0.2) return "angry";

  return "neutral";
};
