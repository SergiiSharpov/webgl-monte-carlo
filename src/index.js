import * as dat from 'dat.gui';
import {
  PlaneBufferGeometry,
  BoxBufferGeometry,
  MeshBasicMaterial,
  Mesh,
  Group,
  PerspectiveCamera,
  Scene,
  Vector2,
  SphereBufferGeometry,
  ConeBufferGeometry
} from 'three';

import GIRenderer from './GIRenderer';

let lightMaterial = new MeshBasicMaterial({color: 0xffffff});

let whiteMaterial = new MeshBasicMaterial({color: 0xbabcba});
let blueMaterial = new MeshBasicMaterial({color: 0x2196f3});
let redMaterial = new MeshBasicMaterial({color: 0xf44336});

let purpleMaterial = new MeshBasicMaterial({color: 0x00ff0a});
let subLight, mainLight;

const mainLightProps = {width: 0.3, height: 0.005, depth: 0.3}

const createCornellBoxObject = () => {
  let planeGeometry = new PlaneBufferGeometry(1.0, 1.0);

  let lightGeometry = new BoxBufferGeometry(mainLightProps.width, mainLightProps.height, mainLightProps.depth);
  

  let box1Geometry = new BoxBufferGeometry(0.3, 0.6, 0.3);
  let box2Geometry = new BoxBufferGeometry(0.3, 0.3, 0.3);

  let planeBottom = new Mesh(planeGeometry.clone(), whiteMaterial);
  let planeTop = new Mesh(planeGeometry.clone(), whiteMaterial);
  let planeBack = new Mesh(planeGeometry.clone(), whiteMaterial);
  let planeFront = new Mesh(planeGeometry.clone(), whiteMaterial);
  let planeLeft = new Mesh(planeGeometry.clone(), redMaterial);
  let planeRight = new Mesh(planeGeometry.clone(), blueMaterial);

  let box1 = new Mesh(box1Geometry, whiteMaterial);
  let box2 = new Mesh(box2Geometry, whiteMaterial);

  let light = new Mesh(lightGeometry, lightMaterial);
  light.userData.isLight = true;
  light.userData.intensity = 2.0;
  light.userData.distance = 2.0;

  mainLight = light;


  let sphereLight = new Mesh(new BoxBufferGeometry(0.1, 0.1, 0.1), purpleMaterial);//new ConeBufferGeometry(0.05, 0.1, 32)
  sphereLight.position.set(-0.05, -0.43, 0.1);
  sphereLight.userData.isLight = true;
  sphereLight.userData.intensity = 2.0;
  sphereLight.userData.distance = 0.2;

  subLight = sphereLight;


  let group = new Group();

  group.add(planeLeft, planeRight, planeTop, planeBottom, planeFront, planeBack, light, box1, box2);

  box1.position.set(-0.2, -0.2, -0.2);
  box1.rotation.y = Math.PI * 0.2;

  box2.position.set(0.2, -0.35, 0.15);
  box2.rotation.y = -Math.PI * 0.15;

  planeRight.rotation.y = -Math.PI * 0.5;
  planeRight.position.x = 0.5;

  planeLeft.rotation.y = Math.PI * 0.5;
  planeLeft.position.x = -0.5;

  planeBack.position.z = -0.5;

  planeFront.rotation.y = Math.PI;
  planeFront.position.z = 0.5;

  planeTop.rotation.x = -Math.PI * 0.5;
  planeTop.position.y = -0.5;

  planeBottom.rotation.x = Math.PI * 0.5;
  planeBottom.position.y = 0.5;

  light.position.y = 0.48;
  //light.position.y = 0.4;

  return group;
}


const camera = new PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 10);
camera.position.z = 1.2;
camera.aspect = 1.0;


const scene = new Scene();
const cornell = createCornellBoxObject();
scene.add(cornell);


const renderer = new GIRenderer(scene, camera);
renderer.setSize(480, 480);
renderer.setChunkSize(32);

document.body.appendChild(renderer.domElement);


const startBtn = document.body.querySelector('.start-button');
const bar = document.body.querySelector('.progress-bar .bar');

renderer.on('begin', () => {
  console.time('render');
  startBtn.classList.add('locked');
  startBtn.innerText = 'Stop';
});
renderer.on('finish', () => {
  console.timeEnd('render');
  startBtn.classList.remove('locked');
  bar.style.width = "0";
  startBtn.innerText = 'Render';
});
renderer.on('progress', (e) => {
  bar.style.width = `${(e.loaded / e.total) * 100}%`;
});


startBtn.addEventListener('click', () => {
  if (!startBtn.classList.contains('locked')) {
    renderer.render();
  } else {
    renderer.finish();
  }
});

//camera.aspect = 1.0;
// renderer.setSize(480, 480);
// renderer.setChunkSize(32);

const gui = new dat.GUI();

const renderFolder = gui.addFolder('Rendering');

renderFolder.add(renderer, 'samples', 1, 1024, 1);
renderFolder.add(renderer, 'bounces', 1, 32, 1);
renderFolder.add(renderer, 'lightSamples', 1, 32, 1);


const optFolder = gui.addFolder('Optimizations');

optFolder.add(renderer, 'chunkSize', 16, 128, 16).onChange(v => {
  renderer.setChunkSize(v);
  gui.updateDisplay();
});
optFolder.add(renderer, 'workerCount', 1, 16, 1);
optFolder.add({screenSize: renderer.size.x}, 'screenSize', 32, 2048, 32).onChange(v => {
  renderer.setSize(v, v);
  gui.updateDisplay();
});

const lightFolder = gui.addFolder('Main light');
lightFolder.addColor({lightColor: '#' + lightMaterial.color.getHexString()}, 'lightColor').onChange(v => lightMaterial.color.set(v));
lightFolder.add(mainLightProps, 'width', 0.001, 1, 0.001).onChange(v => {
  mainLight.geometry = new BoxBufferGeometry(mainLightProps.width, mainLightProps.height, mainLightProps.depth);
});
lightFolder.add(mainLightProps, 'height', 0.001, 1, 0.001).onChange(v => {
  mainLight.geometry = new BoxBufferGeometry(mainLightProps.width, mainLightProps.height, mainLightProps.depth);
});
lightFolder.add(mainLightProps, 'depth', 0.001, 1, 0.001).onChange(v => {
  mainLight.geometry = new BoxBufferGeometry(mainLightProps.width, mainLightProps.height, mainLightProps.depth);
});

lightFolder.add(mainLight.userData, 'intensity', 0.001, 10.0, 0.001);
lightFolder.add(mainLight.userData, 'distance', 0.001, 4.0, 0.001);


const subLightFolder = gui.addFolder('Sub light');
subLightFolder.addColor({subLightColor: '#' + purpleMaterial.color.getHexString()}, 'subLightColor').onChange(v => purpleMaterial.color.set(v));
subLightFolder.add({subLight: false}, 'subLight').onChange(v => {
  if (v) {
    cornell.add(subLight);
  } else {
    cornell.remove(subLight);
  }
});

subLightFolder.add(subLight.userData, 'intensity', 0.001, 10.0, 0.001);
subLightFolder.add(subLight.userData, 'distance', 0.001, 4.0, 0.001);


const sceneFolder = gui.addFolder('Scene');

sceneFolder.addColor({wallColor: '#' + whiteMaterial.color.getHexString()}, 'wallColor').onChange(v => whiteMaterial.color.set(v));
sceneFolder.addColor({rightWallColor: '#' + blueMaterial.color.getHexString()}, 'rightWallColor').onChange(v => blueMaterial.color.set(v));
sceneFolder.addColor({leftWallColor: '#' + redMaterial.color.getHexString()}, 'leftWallColor').onChange(v => redMaterial.color.set(v));



