import {Color, Matrix4, ObjectLoader, Raycaster, Vector2, Vector3} from 'three';
import { RENDER_STATE } from "./constant";

const send = (code, value) => self.postMessage({code, value})

const readyToProcessChunk = (chunk, id) => send(RENDER_STATE.CHUNK_BEGIN, {chunk, renderId: id});
const updateChunk = (chunk, id) => send(RENDER_STATE.CHUNK_END, {chunk, renderId: id});


const randomRange = (min, max) => min + Math.random() * (max - min);

const SETTINGS = {
  HEMISPHERE_SAMPLES: 32,
  MAX_BOUNCES: 1,
  LIGHTSOURCE_SAMPLES: 1
}


const getLightSource = (intersection, lightIntersects) => {
  let isSameTriangle = (lightIntersects[0].object === intersection.object) && (lightIntersects[0].faceIndex === intersection.faceIndex);
  let lightIndex = isSameTriangle ? 1 : 0;

  if (lightIntersects[lightIndex]) {
    if (!lightIntersects[lightIndex].object.userData.isLight) {
      return null;
    } else {
      return lightIntersects[lightIndex];
    }
  }

  return null;
}

const getLigth = (raycaster, scene, intersection, lights, outColor) => {
  let normal = new Vector3();

  let resultLighting = new Color(0.0, 0.0, 0.0);

  for (let light of lights) {
    let lightColor = new Color(0.0, 0.0, 0.0);

    for (let lightSample = 0; lightSample < SETTINGS.LIGHTSOURCE_SAMPLES; lightSample++) {
      let index = Math.floor(randomRange(0, light.geometry.attributes.position.count));

      let direction = new Vector3();

      if (lightSample === 0) {
        direction.copy(light.position).sub(intersection.point).normalize();
      } else {
        direction.fromBufferAttribute(light.geometry.attributes.position, index);
        direction.add(light.position).sub(intersection.point).normalize();
      }

      let origin = new Vector3();
      origin.copy(intersection.point);

      let lightIntensity = normal.copy(intersection.face.normal).applyMatrix4(intersection.object.matrixWorld).dot(direction);
      lightIntensity = Math.max(0.0, lightIntensity);

      raycaster.set(origin, direction);
      let lightIntersects = raycaster.intersectObjects(scene.children, true);

      if (lightIntersects.length) {
        const source = getLightSource(intersection, lightIntersects);

        if (source) {
          // 1.0 / (1.0 + a * dist + b * dist * dist) -> a,b = custom coefs
          // att = 1.0 / (1.0 + dist * dist)
          // let reflect = direction.clone().negate().reflect(source.face.normal);
          // lightIntensity *= 1.0 - reflect.dot(direction);
          
          let intensity =  Math.max(0.0, lightIntensity) * (source.object.userData.intensity || 1.0);
          intensity *= 1.0 / (1.0 + source.distance * source.distance) * source.object.userData.distance;

          lightColor.add(
            source.object.material.color.clone().multiplyScalar(intensity)
          );
        }
      }
    }

    lightColor.multiplyScalar(1.0 / SETTINGS.LIGHTSOURCE_SAMPLES);

    resultLighting.add(lightColor);
  }

  //resultLighting.multiplyScalar(1.0 / lights.length);
  outColor.multiply(resultLighting);
}


const trace = (raycaster, scene, lights, bounce = 0) => {
  const intersects = raycaster.intersectObjects(scene.children, true);

  const outColor = new Color(0.0, 0.0, 0.0);

  if (!intersects.length) {
    return outColor; // There should be bg color
  }

  const intersection = intersects[0];
  const object = intersection.object;

  const color = object.material.color.clone();

  if (object.userData.isLight) {
    return color;
  }

  // intersection.point
  // intersection.face.normal

  getLigth(raycaster, scene, intersection, lights, color);




  let t, n, b;

  t = new Vector3();
  b = new Vector3();
  n = new Vector3();

  t.fromBufferAttribute(object.geometry.attributes.tangent, intersection.face.a);
  //n.fromBufferAttribute(object.geometry.attributes.normal, intersection.face.a);
  b.crossVectors(t, intersection.face.normal);

  const tbn = new Matrix4();
  tbn.makeBasis(t, b, intersection.face.normal);

  let phi, theta, sample, indirectColor;
  let sx, sy, sz;
  let hemiVector = new Vector3();

  if (bounce < SETTINGS.MAX_BOUNCES) {
    const bounceColor = new Color(0.0, 0.0, 0.0);

    for(sample = 0; sample < SETTINGS.HEMISPHERE_SAMPLES; sample++) {
      phi = Math.random() * Math.PI;
      theta = Math.random() * Math.PI;

      sx = Math.sin(theta) * Math.cos(phi);
      sy = Math.cos(theta);
      sz = Math.sin(theta) * Math.sin(phi);

      hemiVector.set(sx, sy, sz).normalize().applyMatrix4(tbn).applyMatrix4(intersection.object.matrixWorld);
      raycaster.set(intersection.point, hemiVector);

      indirectColor = trace(raycaster, scene, lights, bounce + 1);

      bounceColor.add(indirectColor);
    }

    bounceColor.multiplyScalar(1.0 / SETTINGS.HEMISPHERE_SAMPLES);//.multiplyScalar(1.0 / Math.PI);
    color.add(bounceColor);
  }

  outColor.add(color);

  return outColor;
}

const anisotropy = 2.0;
const bias = 0.0001;

const renderChunk = (id, chunk, scene, camera, lights) => {
  readyToProcessChunk(chunk, id);

  const raycaster = new Raycaster();
  const mouse = new Vector2();

  raycaster.near = bias;

  camera.updateProjectionMatrix();
  camera.updateWorldMatrix(true, true);
  scene.updateWorldMatrix(true, true);

  let x, y, xx, yy;
  let x0, x1, y0, y1;

  let a0, a1;

  x0 = chunk.x * chunk.size;
  y0 = chunk.y * chunk.size;
  x1 = x0 + chunk.size;
  y1 = y0 + chunk.size;

  let index = 0;

  for (y = y0; y < y1; y++) {
    for (x = x0; x < x1; x++) {
      const color = new Color(0.0, 0.0, 0.0);

      for (a0 = 0; a0 < anisotropy; a0++) {
        for (a1 = 0; a1 < anisotropy; a1++) {
          xx = x + randomRange((1.0 / anisotropy) * a0, (1.0 / anisotropy) * (a0 + 1.0));
          yy = y + randomRange((1.0 / anisotropy) * a1, (1.0 / anisotropy) * (a1 + 1.0));

          mouse.set(
            (xx / chunk.screen[0]) * 2.0 - 1.0,
            -(yy / chunk.screen[1]) * 2.0 + 1.0
          );
    
          raycaster.setFromCamera(mouse, camera);
          color.add(trace(raycaster, scene, lights));
        }
      }

      color.multiplyScalar(1.0 / (anisotropy * anisotropy));

      chunk.data[index] = Math.min(1.0, color.r) * 255;
      chunk.data[index + 1] = Math.min(1.0, color.g) * 255;
      chunk.data[index + 2] = Math.min(1.0, color.b) * 255;
      chunk.data[index + 3] = 255;

      index += 4;
    }
  }


  updateChunk(chunk, id);
}



const render = ({id, chunks, scene, camera, samples = 32, bounces = 1, lightSamples = 1}) => {
  const loader = new ObjectLoader();
  const currentScene = loader.parse(scene);
  const currentCamera = loader.parse(camera);

  const lights = [];
  currentScene.traverse(object => {
    if (object.userData.isLight) {
      lights.push(object);
    }

    if (object.isMesh) {
      object.geometry.computeTangents();
    }
  })

  SETTINGS.HEMISPHERE_SAMPLES = samples;
  SETTINGS.LIGHTSOURCE_SAMPLES = lightSamples;
  SETTINGS.MAX_BOUNCES = bounces;

  for(let chunk of chunks) {
    renderChunk(id, chunk, currentScene, currentCamera, lights);
  }
}


const onMessage = (event) => {

  switch(event.data.code) {
    case RENDER_STATE.BEGIN:
      render(event.data.value);
    break;

    case RENDER_STATE.CHUNK_BEGIN:

    break;

    case RENDER_STATE.CHUNK_END:

    break;

    case RENDER_STATE.END:

    break;
  }
}


self.addEventListener('message', onMessage);