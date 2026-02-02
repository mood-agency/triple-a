struct Uniforms {
  viewProjection: mat4x4f,
  viewport: vec2f,
  time: f32,
  opacity: f32,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) alpha: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

const LINE_WIDTH: f32 = 0.8;

@vertex
fn vertexMain(
  @location(0) sourcePos: vec2f,
  @location(1) targetPos: vec2f,
  @location(2) corner: f32,
  @location(3) along: f32,
) -> VertexOutput {
  var output: VertexOutput;

  let direction = targetPos - sourcePos;
  let len = length(direction);

  // Handle zero-length edges
  if (len < 0.001) {
    output.position = vec4f(0.0, 0.0, -2.0, 1.0); // Off-screen
    output.alpha = 0.0;
    return output;
  }

  let dir = direction / len;
  let perpendicular = vec2f(-dir.y, dir.x);

  // Interpolate along the edge
  let pos = mix(sourcePos, targetPos, along);

  // Expand perpendicular to line direction for width
  let offset = perpendicular * LINE_WIDTH * corner;
  let worldPos = pos + offset;

  output.position = uniforms.viewProjection * vec4f(worldPos, 0.0, 1.0);
  output.alpha = uniforms.opacity;

  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  // Subtle gray-blue color
  return vec4f(0.5, 0.6, 0.8, input.alpha);
}
