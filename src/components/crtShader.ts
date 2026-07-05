// WebGL CRT effect shaders (vintage TV mode). Extracted from VideoPlayer.tsx.

export const vertexShaderSource = `precision mediump float;

attribute vec2 inPos;
varying vec2 vertPos;

void main()
{
    vertPos = inPos;
    gl_Position = vec4( inPos, 0.0, 1.0 );
}`;

export const fragmentShaderSource = `precision mediump float;

varying vec2 vertPos;
uniform sampler2D u_texture;
uniform float u_distortion;
uniform float u_stripe;
uniform float u_rgbshift;
uniform float u_vignette;
uniform float u_vignette_radius;
uniform float u_edge_aberration;
uniform float u_frame_edge_blur;
uniform float u_center_sharpness;
uniform float u_sharpen_first;
uniform vec2 u_resolution;

// Sharpening helper function - applies unsharp mask with center feathering
vec3 applySharpen(sampler2D tex, vec2 coord, float amount, float centerMask) {
    if (amount < 0.01) return texture2D(tex, coord).rgb;
    
    vec2 pixelSize = 1.0 / u_resolution;
    
    // Sample center and neighbors
    vec3 center = texture2D(tex, coord).rgb;
    vec3 blur = vec3(0.0);
    
    // Simple 3x3 box blur for the unsharp mask
    blur += texture2D(tex, coord + vec2(-pixelSize.x, -pixelSize.y)).rgb;
    blur += texture2D(tex, coord + vec2(0.0, -pixelSize.y)).rgb;
    blur += texture2D(tex, coord + vec2(pixelSize.x, -pixelSize.y)).rgb;
    blur += texture2D(tex, coord + vec2(-pixelSize.x, 0.0)).rgb;
    blur += texture2D(tex, coord).rgb;
    blur += texture2D(tex, coord + vec2(pixelSize.x, 0.0)).rgb;
    blur += texture2D(tex, coord + vec2(-pixelSize.x, pixelSize.y)).rgb;
    blur += texture2D(tex, coord + vec2(0.0, pixelSize.y)).rgb;
    blur += texture2D(tex, coord + vec2(pixelSize.x, pixelSize.y)).rgb;
    blur /= 9.0;
    
    // Unsharp mask: original + (original - blurred) * amount * centerMask
    vec3 sharpened = center + (center - blur) * amount * centerMask;
    return clamp(sharpened, 0.0, 1.0);
}

void main()
{
    vec2 ndc_pos = vertPos;
    vec2 testVec = ndc_pos.xy / max(abs(ndc_pos.x), abs(ndc_pos.y));
    float len = max(1.0,length( testVec ));
    ndc_pos *= mix(1.0, mix(1.0,len,max(abs(ndc_pos.x), abs(ndc_pos.y))), u_distortion);
    vec2 texCoord = vec2(ndc_pos.s, -ndc_pos.t) * 0.52 + 0.5;

    float stripTile = texCoord.t * mix(10.0, 100.0, u_stripe);
    float stripFac = 1.0 + 0.25 * u_stripe * (step(0.5, stripTile-float(int(stripTile))) - 0.5);
    
    // Vignette with smooth feathering to avoid hard circle edge
    float dist = length(ndc_pos);
    float vignette_factor = smoothstep(u_vignette_radius - 0.1, u_vignette_radius + 0.3, dist);
    float vignette = 1.0 - vignette_factor * u_vignette;
    vignette = clamp(vignette, 0.0, 1.0);
    
    // Center sharpening mask - full strength at center, fades to 0 at edges
    // Creates a feathered circle that's strongest in the middle 40% of the screen
    float centerDist = length(ndc_pos);
    float sharpenMask = 1.0 - smoothstep(0.3, 0.9, centerDist);
    
    // Standard chromatic aberration (center to edge)
    float radialShift = 1.0 + length(ndc_pos) * 0.5;
    float shift = u_rgbshift * radialShift;
    
    // Edge-only aberration - calculate distance from edge in pixels
    vec2 pixelCoord = texCoord * u_resolution;
    vec2 edgeDist = min(pixelCoord, u_resolution - pixelCoord);
    float minEdgeDist = min(edgeDist.x, edgeDist.y);
    
    // Create edge mask: 1.0 at edge (0px), 0.0 at 40px+ from edge (thin vaseline-like effect)
    float edgeMask = 1.0 - smoothstep(0.0, 40.0, minEdgeDist);
    
    // Vaseline-like blur on edges only (no chromatic aberration for this effect)
    float blurAmount = u_edge_aberration * edgeMask * 0.002;
    
    // Sample with standard chromatic aberration and edge blur
    float texR, texG, texB;
    vec3 finalColor;
    
    // Apply sharpening first if enabled, otherwise apply after other effects
    if (u_sharpen_first > 0.5 && u_center_sharpness > 0.01) {
        // Sharpen first, then apply chromatic aberration
        vec3 sharpened = applySharpen(u_texture, texCoord.st, u_center_sharpness * 2.0, sharpenMask);
        
        // Now apply effects to the sharpened result (approximation - just use the sharpened center for green)
        if (u_edge_aberration > 0.01 && edgeMask > 0.01) {
            vec3 blurredColor = vec3(0.0);
            blurredColor += applySharpen(u_texture, texCoord.st, u_center_sharpness * 2.0, sharpenMask) * 0.4;
            blurredColor += applySharpen(u_texture, texCoord.st + vec2(blurAmount, 0.0), u_center_sharpness * 2.0, sharpenMask) * 0.15;
            blurredColor += applySharpen(u_texture, texCoord.st - vec2(blurAmount, 0.0), u_center_sharpness * 2.0, sharpenMask) * 0.15;
            blurredColor += applySharpen(u_texture, texCoord.st + vec2(0.0, blurAmount), u_center_sharpness * 2.0, sharpenMask) * 0.15;
            blurredColor += applySharpen(u_texture, texCoord.st - vec2(0.0, blurAmount), u_center_sharpness * 2.0, sharpenMask) * 0.15;
            
            texR = applySharpen(u_texture, texCoord.st - vec2(shift), u_center_sharpness * 2.0, sharpenMask).r;
            texG = blurredColor.g;
            texB = applySharpen(u_texture, texCoord.st + vec2(shift), u_center_sharpness * 2.0, sharpenMask).b;
        } else {
            texR = applySharpen(u_texture, texCoord.st - vec2(shift), u_center_sharpness * 2.0, sharpenMask).r;
            texG = sharpened.g;
            texB = applySharpen(u_texture, texCoord.st + vec2(shift), u_center_sharpness * 2.0, sharpenMask).b;
        }
    } else {
        // Apply chromatic aberration and edge blur first
        if (u_edge_aberration > 0.01 && edgeMask > 0.01) {
            // Multi-sample blur for vaseline effect on edges
            vec3 blurredColor = vec3(0.0);
            blurredColor += texture2D(u_texture, texCoord.st).rgb * 0.4;
            blurredColor += texture2D(u_texture, texCoord.st + vec2(blurAmount, 0.0)).rgb * 0.15;
            blurredColor += texture2D(u_texture, texCoord.st - vec2(blurAmount, 0.0)).rgb * 0.15;
            blurredColor += texture2D(u_texture, texCoord.st + vec2(0.0, blurAmount)).rgb * 0.15;
            blurredColor += texture2D(u_texture, texCoord.st - vec2(0.0, blurAmount)).rgb * 0.15;
            
            // Apply standard chromatic aberration to the blurred edge
            texR = texture2D(u_texture, texCoord.st - vec2(shift)).r;
            texG = blurredColor.g;
            texB = texture2D(u_texture, texCoord.st + vec2(shift)).b;
        } else {
            // Standard chromatic aberration only (no edge blur)
            texR = texture2D(u_texture, texCoord.st - vec2(shift)).r;
            texG = texture2D(u_texture, texCoord.st).g;
            texB = texture2D(u_texture, texCoord.st + vec2(shift)).b;
        }
        
        // Apply sharpening after other effects
        if (u_center_sharpness > 0.01) {
            vec3 baseColor = vec3(texR, texG, texB);
            vec3 sharpened = applySharpen(u_texture, texCoord.st, u_center_sharpness * 2.0, sharpenMask);
            // Blend the sharpened center with the aberrated RGB
            finalColor = mix(baseColor, sharpened, sharpenMask * u_center_sharpness);
        } else {
            finalColor = vec3(texR, texG, texB);
        }
    }
    
    // If sharpen first was used, finalize the color
    if (u_sharpen_first > 0.5 && u_center_sharpness > 0.01) {
        finalColor = vec3(texR, texG, texB);
    }
    
    // Anti-aliased/blurred frame edge (smooth clipping)
    // u_frame_edge_blur: 2 = subtle AA, 10 = soft blur, 50 = heavy blur
    float edgeWidth = u_frame_edge_blur / min(u_resolution.x, u_resolution.y);
    float clipX = smoothstep(0.0, edgeWidth, texCoord.s) * smoothstep(1.0, 1.0 - edgeWidth, texCoord.s);
    float clipY = smoothstep(0.0, edgeWidth, texCoord.t) * smoothstep(1.0, 1.0 - edgeWidth, texCoord.t);
    float clip = clipX * clipY;
    
    // Add dithering to prevent banding in gradients (vignette, etc.)
    // Using a simple pseudo-random pattern based on screen coordinates
    float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    // Scale dither to ±0.5/255.0 (half a bit of color precision)
    dither = (dither - 0.5) / 255.0;
    
    gl_FragColor  = vec4( finalColor * stripFac * vignette * clip + dither, 1.0 );
}`;
