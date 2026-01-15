import * as tf from "@tensorflow/tfjs";
import * as facemesh from "@tensorflow-models/facemesh";

let model = null;
let modelLoading = false;

export const loadFaceMesh = async () => {
  if (model) return model;
  if (modelLoading) return null;

  try {
    modelLoading = true;
    await tf.ready();
    model = await facemesh.load({ maxFaces: 1 });
    return model;
  } catch (error) {
    modelLoading = false;
    return null;
  }
};

export const detectSmile = async (video) => {
  if (!model) {
    return false;
  }

  try {
    const predictions = await model.estimateFaces({ input: video });

    if (predictions.length === 0) {
      return false;
    }

    const face = predictions[0];
    const landmarks = face.scaledMesh;

    // Smile detection using landmarks
    // Points: 61 = left mouth corner, 291 = right mouth corner
    // Points: 0 = upper lip center, 17 = lower lip center

    const leftMouth = landmarks[61];
    const rightMouth = landmarks[291];
    const upperLip = landmarks[13];
    const lowerLip = landmarks[14];

    // Calculate vertical distance (smile indicator)
    const mouthWidth = Math.sqrt(
      Math.pow(rightMouth[0] - leftMouth[0], 2) +
        Math.pow(rightMouth[1] - leftMouth[1], 2)
    );

    const lipDistance = Math.sqrt(
      Math.pow(upperLip[0] - lowerLip[0], 2) +
        Math.pow(upperLip[1] - lowerLip[1], 2)
    );

    // Smile ratio: when person smiles, mouth opens wider
    const smileRatio = mouthWidth / (lipDistance + 1);

    // If smile ratio is high enough, person is smiling
    return smileRatio > 3.5;
  } catch (error) {
    return false;
  }
};

export const getFacePosition = async (video) => {
  if (!model) return null;

  try {
    const predictions = await model.estimateFaces({ input: video });

    if (predictions.length === 0) return null;

    const face = predictions[0];
    const landmarks = face.scaledMesh;

    // Get nose position as reference
    const noseTip = landmarks[1];

    return {
      x: noseTip[0],
      y: noseTip[1],
      z: noseTip[2],
    };
  } catch (error) {
    return null;
  }
};
