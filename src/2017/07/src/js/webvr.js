import qs from 'query-string';

/*
 * video setting
 */
//  navigator
//    .mediaDevices
//    .enumerateDevices()
//    .then(gotDevice)
//    .then(getStream);
//  
//  const camvideo = document.querySelector('.js-monitor');
//  
//  navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
//  window.URL = window.URL || window.webkitURL;
//  
//  function option(id) {
//    return {
//      video: {
//        optional: [{
//          sourceId: id
//        }]
//      }
//    }
//  }
//  
//  function gotDevice(deviceInfos) {
//    const ids = [];
//    // 背面カメラを使う
//    return new Promise(resolve=>{
//      deviceInfos.forEach(v=>{
//        if(v.kind === 'videoinput') {
//          ids.push(v.deviceId)
//        }
//      });
//      resolve(option(ids[1] || ids[0]));
//    });
//  }
//  
//  function getStream(opts) {
//    navigator.getUserMedia(opts, gotStream, noStream);
//  }
//  
//  function gotStream(stream) {
//    if(window.URL) {
//      camvideo.src = window.URL.createObjectURL(stream);
//    } else {
//      camvideo.src = stream;
//    }
//    stream.onended = noStream;
//  }
//  
//  function noStream(e) {
//    let msg = 'No camera available.';
//    if(e.code === 1) {
//      msg = 'User denied access to use camera.'; 
//    }
//    console.log(msg);
//  }
//  
//  function handleError(error) {
//    console.log('Error: ', error);
//  }



let scene, camera, renderer, controls, stats, manager;
let kado = {};
let prevCameraMatrixWorld;

let video, videoImage, videoImageContext, videoTexture;

const clock = new THREE.Clock();

const config = {
	camera: 'Orbit',
	resolution: 512,
	aspectRatio: 1,
	pixelRatio: 2.0,
	time: 0,
	// mandel box
	kadoScale: 2.7,
};


init();
animate();

function init() {
  // scene
  scene = new THREE.Scene();

  // camera
  const WIDTH = window.innerWidth,
        HEIGHT = window.innerHeight,
        ANGLE = 45,
        ASPECT = WIDTH / HEIGHT,
        NEAR = 0.1,
        FAR = 15;


  camera = new THREE.PerspectiveCamera(ANGLE, ASPECT, NEAR, FAR);
  scene.add(camera);
	// camera.position.z = 16;
  camera.position.set(3, -5, 5);
  camera.lookAt(scene.position);

	// camera = new THREE.PerspectiveCamera(35, 800/600);
	// camera.lookAt(new THREE.Vector3(0.0, 0.0, 0.0));

  // renderer
  renderer = new THREE.WebGLRenderer();
  renderer.setSize(WIDTH, HEIGHT);
	renderer.setPixelRatio(config.pixelRatio);
	// renderer.setSize(config.resolution * config.aspectRatio, config.resolution);

  const container = document.querySelector('.js-main');
  container.appendChild(renderer.domElement);

	if (!renderer.extensions.get("EXT_shader_texture_lod")) {
		alert("EXT_shader_texture_lod is not supported.");
		return;
	}

  // controls
  controls = new THREE.OrbitControls(camera, renderer.domElement);

  // controls = new THREE.VRControls(camera);
  // controls.standing = true;
  // const effect = new THREE.VREffect(renderer);
  // effect.setSize(window.innerWidth, window.innerHeight);
  // manager = new WebVRManager(renderer, effect);

  // debug
  var axes = new THREE.AxisHelper(100);
  scene.add(axes);

  const opts = qs.parse(location.search);
  let urls;
  switch(opts.view) {
    case 'city':
      urls = ["img/city/px.jpg", "img/city/nx.jpg", "img/city/py.jpg", "img/city/ny.jpg", "img/city/pz.jpg", "img/city/nz.jpg"];
      break;
    case 'space':
      urls = ["img/space/px.jpg", "img/space/nx.jpg", "img/space/py.jpg", "img/space/ny.jpg", "img/space/pz.jpg", "img/space/nz.jpg"];
      break;
    default:
      urls = ["img/px.jpg", "img/nx.jpg", "img/py.jpg", "img/ny.jpg", "img/pz.jpg", "img/nz.jpg"];
      break;
  }
  const scCube = THREE.ImageUtils.loadTextureCube(urls);
  scCube.format = THREE.RGBFormat;
  const  skyShader = THREE.ShaderLib["cube"];
  skyShader.uniforms["tCube"].value = scCube;
  const skyMaterial = new THREE.ShaderMaterial({
        fragmentShader: skyShader.fragmentShader,
        vertexShader: skyShader.vertexShader,
        uniforms: skyShader.uniforms,
        depthWrite: false,
        side: THREE.BackSide
    });
  const skyBox = new THREE.Mesh(new THREE.CubeGeometry(5000, 5000, 5000), skyMaterial);
  skyMaterial.needsUpdate = true;
  scene.add(skyBox);


  /*
   * video
   */
  //  video = document.querySelector('.js-monitor');
  //  videoImage = document.getElementsByClassName('js-monitor-canvas')[0];
  //  videoImageContext = videoImage.getContext('2d');

  //  videoImageContext.fillStyle = '#000000';
  //  videoImageContext.fillRect(0, 0, videoImage.width, videoImage.height);

  //  videoTexture= new THREE.Texture(videoImage);
  //  videoTexture.minFilter = THREE.LinearFilter;
  //  videoTexture.magFilter = THREE.LinearFilter;

  //  const webcamMaterial = new THREE.MeshBasicMaterial({ map: videoTexture, overdraw: true, side: THREE.DoubleSide }),
  //        // webcamGeometry = new THREE.PlaneGeometry(100, 100, 1, 1),
  //        webcamGeometry = new THREE.BoxGeometry(2000, 2000, 2000),
  //        webcamScreen   = new THREE.Mesh(webcamGeometry, webcamMaterial);
  //  webcamScreen.position.set(0,0,0);
  //  scene.add(webcamScreen);


  // kado
	kado.geometry = new THREE.PlaneBufferGeometry(2.0, 2.0);
  kado.material = new THREE.RawShaderMaterial({
    uniforms: {
			resolution: {type: 'v2', value: new THREE.Vector2(config.resolution, config.resolution)},
			time: {type: 'f', value: 0.0 },
			cameraPos: {type: 'v3', value: camera.getWorldPosition()},
			cameraDir: {type: 'v3', value: camera.getWorldDirection()},
			kadoScale: {type: 'f', value: config.kadoScale},
    },
		vertexShader: document.getElementById('vertexShader').textContent,
		fragmentShader: document.getElementById('fragmentShader').textContent
  });
	const plane = new THREE.Mesh(kado.geometry, kado.material);
	plane.frustumCulled = false;
	scene.add(plane);
}

function animate() 
{

	var delta = clock.getDelta();
	if (false) {
		config.time += delta;
	}
	var needsUpdate = config.time !== kado.material.uniforms.time.value;
  if (camera && prevCameraMatrixWorld && !camera.matrixWorld.equals(prevCameraMatrixWorld)) {
    needsUpdate = true;
  }
  prevCameraMatrixWorld = camera.matrixWorld.clone();

  requestAnimationFrame( animate );
  controls.update();
	render(needsUpdate);
}

function render(needsUpdate) 
{	

	// if ( video.readystate === video.have_enough_data ) 
	// {
	// 	videoImageContext.drawImage( video, 0, 0, videoImage.width, videoImage.height );
	// 	if ( videoTexture ) 
	// 		videoTexture.needsupdate = true;
	// }

	kado.material.uniforms.resolution.value = new THREE.Vector2(renderer.domElement.width, renderer.domElement.height);
	kado.material.uniforms.cameraPos.value = camera.getWorldPosition();
	kado.material.uniforms.cameraDir.value = camera.getWorldDirection();
	kado.material.uniforms.kadoScale.value = config.kadoScale;
	kado.material.uniforms.time.value = config.time;

  renderer.render( scene, camera );
  if(needsUpdate) {
    renderer.render( scene, camera );
    // manager.render( scene, camera);
  }
}
