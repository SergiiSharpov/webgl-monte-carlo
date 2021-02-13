import EventEmitter from 'events';
import _ from 'lodash';
import {Vector2, ObjectLoader} from 'three';
import { v4 as uuidv4 } from 'uuid';
import { RENDER_STATE } from './constant.js';

import Worker from "./renderer.worker.js";

const onWorkerMessage = (workerNumber) => {
  return function(event) {
    let renderId = event.data.value.renderId;
    if (renderId !== this.renderId) {
      console.warn('Skipping chunk with incorrect render ID');
      return false;
    }

    let chunk;

    switch(event.data.code) {
      case RENDER_STATE.CHUNK_BEGIN:
        chunk = event.data.value.chunk;

        const currentDataSet = {
          id: chunk.id,
          x: chunk.x * chunk.size,
          y: chunk.y * chunk.size,
          data: null
        }

        this.imageDataSet.push(currentDataSet);

        requestAnimationFrame(() => this.renderDataSets());
      break;

      case RENDER_STATE.CHUNK_END:
        chunk = event.data.value.chunk;
        const img = new Uint8ClampedArray(chunk.data.buffer);

        const set = this.imageDataSet.find(target => target.id === chunk.id);

        if (set) {
          set.data = new ImageData(img, chunk.size, chunk.size);

          this.processedChunks++;

          this.emit('progress', {total: this.totalChunks, loaded: this.processedChunks});

          if (this.processedChunks >= this.totalChunks) {
            requestAnimationFrame(() => {
              this.renderDataSets();
              this.emit('finish');
            });
          } else {
            requestAnimationFrame(() => this.renderDataSets());
          }
        }
      break;
    }
  }
}

class GIRenderer extends EventEmitter {
  constructor(scene, camera) {
    super();

    this.scene = scene;
    this.camera = camera;

    this.size = new Vector2();
    this.domElement = document.createElement('canvas');

    this.ctx = this.domElement.getContext('2d');

    this.renderId = null;

    this.chunkSize = 48;
    this.chunkCount = new Vector2(1, 1);

    this.workers = [];
    this.chunks = [];

    this.currentChunks = [];
    this.imageDataSet = [];
    this.totalChunks = 0;
    this.processedChunks = 0;

    this.workerCount = window.navigator.hardwareConcurrency;

    this.samples = 1;
    this.bounces = 1;
    this.lightSamples = 1;

    this.setSize(256, 256);

    this.on('finish', this.reset);
  }

  finish() {
    this.emit('finish');
    this.reset();
    this.renderDataSets();
  }

  reset() {
    for(let worker of this.workers) {
      worker.terminate();
    }

    this.renderId = null;

    this.workers = [];
    this.chunks = [];

    this.currentChunks = [];
    this.imageDataSet = [];
    this.totalChunks = 0;
    this.processedChunks = 0;

    for (let i = 0; i < this.workerCount; i++) {
      const worker = new Worker();
      worker.send = (code, value) => worker.postMessage({code, value})

      const fn = onWorkerMessage(i).bind(this);

      worker.addEventListener('message', fn);

      this.workers.push(worker);
    }
  }

  setSize(width, height) {
    this.size.set(width, height);

    this.domElement.width = width;
    this.domElement.height = height;

    let min = Math.min(width, height);
    if (this.chunkSize > min) {
      this.chunkSize = min;
    }

    this.chunkCount.set(
      Math.ceil(width / this.chunkSize),
      Math.ceil(height / this.chunkSize)
    );
  }

  setChunkSize(size) {
    this.chunkSize = size;
    this.setSize(this.size.x, this.size.y);
  }

  renderDataSets() {
    let i = 0;
    let dataSet;

    this.ctx.strokeStyle = '#0088ff';
    this.ctx.clearRect(0, 0, this.size.x, this.size.y);

    while (i < this.imageDataSet.length) {
      dataSet = this.imageDataSet[i];

      if (dataSet.data) {
        this.ctx.putImageData(dataSet.data, dataSet.x, dataSet.y);
      } else {
        this.ctx.strokeRect(dataSet.x, dataSet.y, this.chunkSize, this.chunkSize);
      }

      i++;
    }
  }

  render() {
    this.emit('begin');

    this.reset();

    this.renderId = uuidv4();

    let chunks = [];

    let chunkId = 0;
    for (let w = 0; w < this.chunkCount.x; w++) {
      for (let h = 0; h < this.chunkCount.y; h++) {
        chunks.push({
          id: chunkId,

          x: w,
          y: h,

          size: this.chunkSize,

          screen: [this.size.x, this.size.y],

          data: new Uint8Array(this.chunkSize * this.chunkSize * 4)
        })

        chunkId++;
      }
    }

    this.totalChunks = chunks.length;
    this.chunks = _.chunk(_.shuffle(chunks), Math.ceil(chunks.length / this.workerCount));


    this.camera.updateProjectionMatrix();
    this.camera.updateWorldMatrix(true, true);
    this.scene.updateWorldMatrix(true, true);

    const scene = this.scene.toJSON();
    const camera = this.camera.toJSON();

    for (let i = 0; i < this.workerCount; i++) {
      const data = {
        chunks: this.chunks[i],
        id: this.renderId,
        scene,
        camera,
        samples: this.samples, bounces: this.bounces, lightSamples: this.lightSamples
      }
      this.workers[i].send(RENDER_STATE.BEGIN, data);
    }
  }
}

export default GIRenderer;