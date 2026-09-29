const MAX_ASSESSMENT_SUBMISSION_BYTES = 4_500_000;
const MAP_RESIZE_ATTEMPTS = 6;
const MAP_RESIZE_HEADROOM_BYTES = 32_000;

export class AssessmentSubmissionTooLargeError extends Error {}

export async function serializeAssessmentSubmission<
  Payload extends { mapImageDataUrl: string },
>(payload: Payload): Promise<string> {
  let candidate = payload;
  let body = JSON.stringify(candidate);
  if (requestByteLength(body) <= MAX_ASSESSMENT_SUBMISSION_BYTES) return body;

  const image = await loadMapImage(payload.mapImageDataUrl);
  let width = image.naturalWidth || image.width;
  let height = image.naturalHeight || image.height;

  for (let attempt = 0; attempt < MAP_RESIZE_ATTEMPTS; attempt += 1) {
    const overage = requestByteLength(body) - MAX_ASSESSMENT_SUBMISSION_BYTES;
    const availableMapBytes = Math.max(
      1,
      candidate.mapImageDataUrl.length - overage - MAP_RESIZE_HEADROOM_BYTES,
    );
    const scale = Math.min(
      0.85,
      Math.max(
        0.5,
        Math.sqrt(availableMapBytes / candidate.mapImageDataUrl.length),
      ),
    );
    width = Math.max(1, Math.floor(width * scale));
    height = Math.max(1, Math.floor(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new AssessmentSubmissionTooLargeError();
    context.drawImage(image, 0, 0, width, height);
    candidate = {
      ...candidate,
      mapImageDataUrl: canvas.toDataURL("image/png"),
    };
    body = JSON.stringify(candidate);
    if (requestByteLength(body) <= MAX_ASSESSMENT_SUBMISSION_BYTES) return body;
  }

  throw new AssessmentSubmissionTooLargeError();
}

function loadMapImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new AssessmentSubmissionTooLargeError());
    image.src = dataUrl;
  });
}

function requestByteLength(body: string): number {
  return new TextEncoder().encode(body).byteLength;
}
