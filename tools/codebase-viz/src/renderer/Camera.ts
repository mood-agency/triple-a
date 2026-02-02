export interface Camera {
  x: number;
  y: number;
  zoom: number;
  minZoom: number;
  maxZoom: number;
}

export function createCamera(): Camera {
  return {
    x: 0,
    y: 0,
    zoom: 1,
    minZoom: 0.1,
    maxZoom: 10,
  };
}

export function getViewProjectionMatrix(
  camera: Camera,
  width: number,
  height: number
): Float32Array {
  const mat = new Float32Array(16);

  // Orthographic projection with pan and zoom
  const scaleX = (2 / width) * camera.zoom;
  const scaleY = (2 / height) * camera.zoom;
  const translateX = -camera.x * scaleX;
  const translateY = -camera.y * scaleY;

  // Column-major 4x4 identity matrix with scale and translate
  mat[0] = scaleX;
  mat[1] = 0;
  mat[2] = 0;
  mat[3] = 0;

  mat[4] = 0;
  mat[5] = -scaleY; // Flip Y for screen coordinates
  mat[6] = 0;
  mat[7] = 0;

  mat[8] = 0;
  mat[9] = 0;
  mat[10] = 1;
  mat[11] = 0;

  mat[12] = translateX;
  mat[13] = -translateY;
  mat[14] = 0;
  mat[15] = 1;

  return mat;
}

export function screenToWorld(
  camera: Camera,
  screenX: number,
  screenY: number,
  canvasWidth: number,
  canvasHeight: number
): [number, number] {
  const worldX = (screenX - canvasWidth / 2) / camera.zoom + camera.x;
  const worldY = (screenY - canvasHeight / 2) / camera.zoom + camera.y;
  return [worldX, worldY];
}

export function worldToScreen(
  camera: Camera,
  worldX: number,
  worldY: number,
  canvasWidth: number,
  canvasHeight: number
): [number, number] {
  const screenX = (worldX - camera.x) * camera.zoom + canvasWidth / 2;
  const screenY = (worldY - camera.y) * camera.zoom + canvasHeight / 2;
  return [screenX, screenY];
}
