#extension GL_EXT_shader_texture_lod : enable
precision highp float;

// uniforms
uniform float time;
uniform vec2 mouse;
uniform vec2 resolution;

uniform samplerCube textureCube;
uniform sampler2D groundHeight;

uniform bool debugCamera;
uniform vec3 cameraPos;
uniform vec3 cameraDir;

// uniform float kadoScale;
float kadoScale;

// consts
const float INF = 1e+10;
const float EPS = 1e-2;
const float EPS_N = 1e-3;
const float OFFSET = EPS * 100.0;

const float PI = 3.14159265359;
const float PI2 = 6.28318530718;
const float PIH = 1.57079632679;
const float PIQ = 0.78539816339;

const float GROUND_BASE = 5.5;


// globals
const vec3 lightDir = vec3( -0.48666426339228763, 0.8111071056538127, -0.3244428422615251 );
float lTime;

// ray
struct Ray {
	vec3 origin;
	vec3 direction;
};

// camera
struct Camera {
	vec3 eye, target;
	vec3 forward, right, up;
	float zoom;
};

Ray cameraShootRay(Camera c, vec2 uv) {
	c.forward = normalize(c.target - c.eye);
	c.right = normalize(cross(c.forward, c.up));
	c.up = normalize(cross(c.right, c.forward));

	Ray r;
	r.origin = c.eye;
	r.direction = normalize(uv.x * c.right + uv.y * c.up + c.zoom * c.forward);

	return r;
}

// intersection
struct Intersection {
	bool hit;
	vec3 position;
	float distance;
	vec3 normal;
	vec2 uv;
	float count;

	int material;
	vec3 color;
	float reflectance;
};

#define METAL_MATERIAL   0
#define GROUND_MATERIAL  1

// util
#define saturate(x) clamp(x, 0.0, 1.0)

// Distance Functions
float sdBox( vec3 p, vec3 b ) {
  vec3 d = abs(p) - b;
  return min(max(d.x,max(d.y,d.z)),0.0) + length(max(d,0.0));
}

#define WORK_TIME (60.0)

// http://blog.hvidtfeldts.net/index.php/2011/11/distance-estimated-3d-fractals-vi-the-mandelbox/
float minRadius2 = 0.5;
float fixedRadius2 = 1.0;
float foldingLimit = 1.0;
#define Iterations 8

void sphereFold(inout vec3 z, inout float dz) {
	float r2 = dot(z,z);
	if (r2 < minRadius2) {
		// linear inner scaling
		float temp = (fixedRadius2 / minRadius2);
		z *= temp;
		dz *= temp;
	} else if (r2 < fixedRadius2) {
		// this is the actual sphere inversion
		float temp = fixedRadius2 / r2;
		z *= temp;
		dz *= temp;
	}
}

void boxFold(inout vec3 z, inout float dz) {
	z = clamp(z, -foldingLimit, foldingLimit) * 2.0 - z;
}

float dMbox(vec3 z) {
	vec3 offset = z;
	float dr = 1.0;
	for (int n = 0; n < Iterations; n++) {
		boxFold(z, dr);       // Reflect
		sphereFold(z, dr);    // Sphere Inversion
		z = kadoScale * z + offset;  // Scale & Translate
		dr = dr * abs(kadoScale) + 1.0;
	}
	float r = length(z);
	return r / abs(dr);
}

float dScene(vec3 p) {
	return dMbox(p);
}

// color functions
vec3 hsv2rgb(vec3 c) {
	vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
	vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
	return c.z * mix(K.xxx, saturate(p - K.xxx), c.y);
}

#define calcNormal(p, dFunc) normalize(vec2(EPS_N, -EPS_N).xyy * dFunc(p + vec2(EPS_N, -EPS_N).xyy) + vec2(EPS_N, -EPS_N).yyx * dFunc(p + vec2(EPS_N, -EPS_N).yyx ) + vec2(EPS_N, -EPS_N).yxy * dFunc(p + vec2(EPS_N, -EPS_N).yxy) + vec2(EPS_N, -EPS_N).xxx * dFunc(p + vec2(EPS_N, -EPS_N).xxx))

float sdGround(in vec3 p) {
	return p.y - texture2D(groundHeight, p.xz * 0.1).r + GROUND_BASE;
}

void intersectObjects(inout Intersection intersection, inout Ray ray) {
	float d;
	float distance = 0.0;
	vec3 p = ray.origin;

	for (float i = 0.0; i < 100.0; i++) {
		d = dScene(p);
		distance += d;
		p = ray.origin + distance * ray.direction;
		intersection.count = i;
		if (abs(d) < EPS || distance > 100.0) break;
	}

	if (abs(d) < EPS && distance < intersection.distance) {
		intersection.distance = distance;
		intersection.hit = true;
		intersection.position = p;
		intersection.normal = calcNormal(p, dScene);
		intersection.material = METAL_MATERIAL;
	}
}

void intersectScene(inout Intersection intersection, inout Ray ray) {
	intersection.distance = INF;
	intersectObjects(intersection, ray);
}

float calcAo(in vec3 p, in vec3 n){
	float sca = 1.0, occ = 0.0;
	for(float i=0.; i<5.; i++){
		float hr = 0.05 + i * 0.08;
		float dd = dScene(n * hr + p);
		occ += (hr - dd) * sca;
		sca *= 0.5;
	}
	return saturate(1.0 - occ);
}

float calcShadow(in vec3 p, in vec3 rd) {
	float d;
	float distance = OFFSET;
	float bright = 1.0;
	float shadowIntensity = 0.4;
	float shadowSharpness = 10.0;

	for (int i = 0; i < 30; i++) {
		d = dScene(p + rd * distance);
		if (d < EPS) return shadowIntensity;
		bright = min(bright, shadowSharpness * d / distance);
		distance += d;
	}

	return shadowIntensity + (1.0 - shadowIntensity) * bright;
}

void calcRadiance(inout Intersection intersection, inout Ray ray, int bounce) {
	intersection.hit = false;
	intersectScene(intersection, ray);

	if ( intersection.hit ) {
		float diffuse = clamp(dot(lightDir, intersection.normal), 0.2, 1.0) * 0.5 + 0.5;
		float specular = pow(saturate(dot(reflect(lightDir, intersection.normal), ray.direction)), 10.0);
		float ao = calcAo(intersection.position, intersection.normal);
		float shadow = calcShadow(intersection.position, lightDir);

		if (intersection.material == METAL_MATERIAL) {
			vec3 metalBase = hsv2rgb(vec3(0.1 * intersection.count + sin(0.05 * PI2 * lTime), 0.7 * 0.5 + abs(0.05 * PI2 * sin(0.1 * lTime)), 0.9));
			intersection.color = metalBase * diffuse * ao * shadow + 0.1 * specular;
			intersection.reflectance = 0.7;
		} else {
			vec3 metalBase = vec3(0.17, 0.25, 0.28);
			intersection.color = metalBase * diffuse * ao * shadow + 0.5 * specular;
			float f0 = 0.7;
			intersection.reflectance = f0 + (1.0 - f0) * pow(1.0 + ray.direction.y, 5.0);
		}
	} else {
		intersection.color = textureCubeLodEXT(textureCube, ray.direction, 0.0).rgb;
	}
}

void main(void) {
	// set globals
	lTime = mod(time, WORK_TIME);
	kadoScale = 2.6 + 0.2 * cos(0.1 * PI2 * time);

	// fragment position
	vec2 uv = ( gl_FragCoord.xy * 2.0 - resolution ) / min( resolution.x, resolution.y );

	// camera and ray
	Camera camera;
	camera.eye    = cameraPos;
	camera.target = cameraPos + cameraDir;
	camera.up = vec3(0.0, 1.0, 0.0);// y-up
	camera.zoom = 2.0;
	Ray ray = cameraShootRay(camera, uv);

	vec3 color = vec3(0.0);
	float reflection = 1.0;
	Intersection intersection;

	for (int bounce = 0; bounce <= 2; bounce++) {
		calcRadiance(intersection, ray, bounce);

		color += reflection * intersection.color;
		if (!intersection.hit) break;
		reflection *= intersection.reflectance;
		ray.origin = intersection.position + intersection.normal * OFFSET;
		ray.direction = normalize(reflect(ray.direction, intersection.normal));
	}

	gl_FragColor = vec4(color, 1.0);
}
