struct Uniforms {
  viewProjection: mat4x4f,
  viewport: vec2f,
  time: f32,
  hoveredNode: f32,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec4f,
  @location(2) nodeIndex: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vertexMain(
  @location(0) vertexPos: vec2f,
  @location(1) instancePos: vec2f,
  @location(2) instanceSize: f32,
  @location(3) instanceColor: vec4f,
  @location(4) nodeIndex: f32,
) -> VertexOutput {
  var output: VertexOutput;

  // Rectangle: width = size * 4, height = size * 1.2
  let width = instanceSize * 4.0;
  let height = instanceSize * 1.2;
  let scaledPos = vec2f(vertexPos.x * width, vertexPos.y * height);
  let worldPos = scaledPos + instancePos;

  output.position = uniforms.viewProjection * vec4f(worldPos, 0.0, 1.0);
  output.uv = vertexPos;
  output.color = instanceColor;
  output.nodeIndex = nodeIndex;

  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let uv = input.uv;
  let cornerRadius = 0.2;

  // Rounded rectangle SDF
  let absUv = abs(uv);
  let corner = max(absUv - vec2f(1.0 - cornerRadius, 1.0 - cornerRadius), vec2f(0.0));
  let cornerDist = length(corner);

  if (cornerDist > cornerRadius) {
    discard;
  }

  // Base color with gradient
  var finalColor = input.color;
  let gradient = 1.0 - uv.y * 0.1;
  finalColor = vec4f(finalColor.rgb * gradient, finalColor.a);

  // Highlight if hovered
  let isHovered = abs(input.nodeIndex - uniforms.hoveredNode) < 0.5;
  if (isHovered) {
    finalColor = vec4f(
      min(finalColor.r * 1.4, 1.0),
      min(finalColor.g * 1.4, 1.0),
      min(finalColor.b * 1.4, 1.0),
      1.0
    );
  }

  // Border effect
  let borderWidth = 0.06;
  let innerRect = vec2f(1.0 - borderWidth, 1.0 - borderWidth);
  let innerCorner = max(absUv - (innerRect - vec2f(cornerRadius)), vec2f(0.0));
  let innerCornerDist = length(innerCorner);
  let isOnBorder = absUv.x > innerRect.x || absUv.y > innerRect.y || (cornerDist > cornerRadius - borderWidth && innerCornerDist > 0.0);

  if (isOnBorder) {
    finalColor = vec4f(finalColor.rgb * 0.5, finalColor.a);
  }

  return finalColor;
}
