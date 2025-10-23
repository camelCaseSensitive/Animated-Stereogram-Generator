// --- Animated Stereogram Generator ---
// Upload multiple depth maps + textures to create looping stereogram animation

let depthImgs = [];    // array of depth maps
let textureImgs = [];  // array of textures
let frames = [];       // generated stereogram frames
let currentFrame = 0;
let animPlaying = false;
let frameInterval = 150; // ms per frame

let imgScaleInput, numStripsInput, depthMultInput;
let generateButton, saveButton, saveGifButton;
let tileTextureCheckbox, mirrorTilesCheckbox;
let outputImgElement;
let depthZone, textureZone;

// --------------------------------------------
// SETUP
// --------------------------------------------
function setup() {
  noCanvas();

  createElement('h1', 'Animated Stereogram Generator')
    .style('text-align', 'center');

  // --- Drag-and-drop zones container ---
  let dropZoneContainer = createDiv().style('display', 'flex')
    .style('justify-content', 'center')
    .style('gap', '20px')
    .style('margin-bottom', '20px')
    .style('flex-wrap', 'wrap');

  depthZone = createDropZone('Drop Depth Maps Here', gotDepthFiles);
  textureZone = createDropZone('Drop Textures Here', gotTextureFiles);
  dropZoneContainer.child(depthZone.container);
  dropZoneContainer.child(textureZone.container);

  // --- Input controls ---
  let inputContainer = createDiv().style('display', 'flex')
    .style('justify-content', 'center')
    .style('gap', '20px')
    .style('margin-bottom', '20px')
    .style('flex-wrap', 'wrap');

  numStripsInput = createLabeledInput('Number of Strips', 6, inputContainer);
  depthMultInput = createLabeledInput('Depth Multiplier', 1.0, inputContainer);
  imgScaleInput = createLabeledInput('Image Scale', 1.0, inputContainer);

  // --- Tile Texture checkbox ---
  let tileContainer = createDiv().style('display', 'flex')
    .style('flex-direction', 'column')
    .style('align-items', 'center');
  createSpan('Tile Texture').style('margin-bottom', '5px').parent(tileContainer);
  tileTextureCheckbox = createCheckbox('', false).parent(tileContainer);
  inputContainer.child(tileContainer);

  // --- Mirror Tiles checkbox ---
  let mirrorContainer = createDiv().style('display', 'flex')
    .style('flex-direction', 'column')
    .style('align-items', 'center');
  createSpan('Mirror Tiles').style('margin-bottom', '5px').parent(mirrorContainer);
  mirrorTilesCheckbox = createCheckbox('', false).parent(mirrorContainer);
  inputContainer.child(mirrorContainer);

  // --- Generate / Save buttons ---
  let buttonContainer = createDiv().style('text-align', 'center');
  generateButton = createButton('Generate Stereogram');
  generateButton.mousePressed(generateAnimatedStereograms);

  saveButton = createButton('Save Frames');
  saveButton.mousePressed(saveAllFrames);
  saveButton.attribute('disabled', true);

  saveGifButton = createButton('Save as GIF');
  saveGifButton.mousePressed(saveAsGif);

  buttonContainer.child(generateButton);
  buttonContainer.child(saveButton);
  buttonContainer.child(saveGifButton);
  buttonContainer.style('margin-bottom', '30px');

  // --- Output display area ---
  createElement('h3', 'Output Animation')
    .style('text-align', 'center')
    .style('margin-top', '10px');

  outputImgElement = createImg('', 'Animated Stereogram');
  outputImgElement.style('display', 'block')
    .style('margin', '20px auto')
    .style('border', '1px solid #ccc')
    .style('background', '#fafafa')
    .style('padding', '10px')
    .style('border-radius', '8px')
    .style('box-shadow', '0 2px 5px rgba(0,0,0,0.1)')
    .style('max-width', '90vw')
    .style('height', 'auto')
    .style('max-height', '80vh')
    .style('object-fit', 'contain')
    .hide();

  // --- Footer ---
  createElement('footer', '© Copyright lavaboosted')
    .style('text-align', 'center')
    .style('margin-top', '40px')
    .style('padding', '10px')
    .style('font-size', '14px')
    .style('color', '#666');
}

// --------------------------------------------
// FILE INPUT HANDLERS
// --------------------------------------------
function createDropZone(labelText, callback) {
  let container = createDiv()
    .style('border', '2px dashed #999')
    .style('padding', '40px')
    .style('text-align', 'center')
    .style('width', '240px')
    .style('height', '180px')
    .style('cursor', 'pointer')
    .style('background-color', '#fafafa')
    .style('position', 'relative')
    .style('overflow', 'hidden');

  let label = createSpan(labelText).parent(container);

  let fileInput = createFileInput((files) => callback(files), true);
  fileInput.parent(container);
  fileInput.elt.multiple = true;
  fileInput.elt.style.display = 'none';

  container.mousePressed(() => fileInput.elt.click());
  container.dragOver(() => container.style('border-color', '#33aaff').style('background-color', '#e6f4ff'));
  container.dragLeave(() => container.style('border-color', '#999').style('background-color', '#fafafa'));
  container.drop((files) => {
    container.style('border-color', '#999').style('background-color', '#fafafa');
    callback(files);
  });

  return { container, fileInput, label };
}

function gotDepthFiles(files) {
  if (!Array.isArray(files)) files = [files];
  showLoadingMessage(depthZone, "Loading depth maps...");

  let loadPromises = files
    .filter(f => f.type === 'image')
    .map(f => new Promise(resolve => {
      loadImage(f.data, img => resolve({ name: f.name, img }));
    }));

  Promise.all(loadPromises).then(loaded => {
    loaded.sort((a, b) => extractFrameNumber(a.name) - extractFrameNumber(b.name));
    depthImgs.push(...loaded.map(l => l.img));
    displayPreviewGrid(depthZone, depthImgs);
    console.log(`✅ Loaded ${depthImgs.length} depth maps (sorted).`);
  });
}

function gotTextureFiles(files) {
  if (!Array.isArray(files)) files = [files];
  showLoadingMessage(textureZone, "Loading textures...");

  let loadPromises = files
    .filter(f => f.type === 'image')
    .map(f => new Promise(resolve => {
      loadImage(f.data, img => resolve({ name: f.name, img }));
    }));

  Promise.all(loadPromises).then(loaded => {
    loaded.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    textureImgs.push(...loaded.map(l => l.img));
    displayPreviewGrid(textureZone, textureImgs);
    console.log(`✅ Loaded ${textureImgs.length} total textures.`);
  });
}

function extractFrameNumber(filename) {
  const match = filename.match(/(\d+)(?=\.[^.]+$)/);
  return match ? parseInt(match[1], 10) : 0;
}

function showLoadingMessage(zone, message = "Loading...") {
  zone.container.html('');
  createP(message)
    .style('position', 'absolute')
    .style('top', '50%')
    .style('left', '50%')
    .style('transform', 'translate(-50%, -50%)')
    .style('margin', '0')
    .style('color', '#666')
    .style('font-size', '14px')
    .style('font-style', 'italic')
    .parent(zone.container);
}

function displayPreviewGrid(zone, imgs) {
  zone.container.html('');
  let grid = createDiv().style('display', 'grid')
    .style('grid-template-columns', 'repeat(auto-fill, minmax(60px, 1fr))')
    .style('gap', '4px')
    .style('width', '100%')
    .style('height', '100%')
    .style('overflow', 'hidden')
    .parent(zone.container);

  imgs.slice(0, 9).forEach(img => {
    createImg(img.canvas.toDataURL(), '')
      .style('width', '100%')
      .style('height', '100%')
      .style('object-fit', 'cover')
      .parent(grid);
  });
}

// --------------------------------------------
// STEREOGRAM GENERATION
// --------------------------------------------
async function generateAnimatedStereograms() {
  if (depthImgs.length === 0 || textureImgs.length === 0) {
    alert("Please upload depth maps and textures first.");
    return;
  }

  const numStrips = parseInt(numStripsInput.value());
  const depthMult = parseFloat(depthMultInput.value());
  const imgScale = parseFloat(imgScaleInput.value());
  const tileTexture = tileTextureCheckbox ? tileTextureCheckbox.checked() : false;
  const mirrorTiles = mirrorTilesCheckbox ? mirrorTilesCheckbox.checked() : false;

  frames = [];

  for (let i = 0; i < depthImgs.length; i++) {
    const depth = depthImgs[i];
    const tex = textureImgs[i % textureImgs.length];
    console.log(`Generating frame ${i + 1}/${depthImgs.length}...`);

    const frame = await generateSingleStereogram(depth, tex, numStrips, depthMult, imgScale, tileTexture, mirrorTiles);
    let imgCopy = createImage(frame.width, frame.height);
    imgCopy.copy(frame, 0, 0, frame.width, frame.height, 0, 0, frame.width, frame.height);
    frames.push(imgCopy);
  }

  console.log(`✅ Generated ${frames.length} frames`);
  playAnimation();
  saveButton.removeAttribute('disabled');
}

// --- Single Stereogram Frame ---
async function generateSingleStereogram(depthImg, textureImg, numStrips, depthMult, imgScale, tileTexture, mirrorTiles) {
  return new Promise((resolve) => {
    let depthCopy = depthImg.get();
    depthCopy.resize(depthCopy.width * imgScale, depthCopy.height * imgScale);

    const stripWidth = Math.floor(depthCopy.width / numStrips);
    const stripHeight = depthCopy.height;
    const cnv = createGraphics(depthCopy.width + stripWidth, stripHeight);
    cnv.pixelDensity(1);
    cnv.noSmooth();

    // --- Tile + Mirror Texture ---
    let textureCopy = textureImg.get();

    if (tileTexture) {
      const targetW = Math.ceil(stripWidth * 1.1);
      const targetH = Math.round(textureCopy.height * targetW / textureCopy.width);
      textureCopy.resize(targetW, targetH);

      const newTexture = createGraphics(textureCopy.width, stripHeight);
      newTexture.noSmooth();

      const copies = Math.ceil(stripHeight / textureCopy.height);
      for (let i = 0; i < copies; i++) {
        if (mirrorTiles && (i % 2 === 1)) {
          newTexture.push();
          newTexture.translate(0, (i + 1) * textureCopy.height);
          newTexture.scale(1, -1);
          newTexture.image(textureCopy, 0, 0);
          newTexture.pop();
        } else {
          newTexture.image(textureCopy, 0, i * textureCopy.height);
        }
      }

      textureCopy = newTexture;
    } else {
      if (stripWidth > textureCopy.width * 1.1) {
        textureCopy.resize(stripWidth * 1.1, textureCopy.height * stripWidth * 1.1 / textureCopy.width);
      }
      if (stripHeight > textureCopy.height) {
        textureCopy.resize(textureCopy.width * stripHeight / textureCopy.height, stripHeight);
      }
    }

    // Paint leftmost strip
    cnv.image(textureCopy, 0, 0, stripWidth, stripHeight);

    // --- Core stereogram generation ---
    depthCopy.loadPixels();
    const dpx = depthCopy.pixels;
    const dW = depthCopy.width;
    const dH = depthCopy.height;
    const outW = cnv.width;
    const shiftLUT = new Int16Array(256);
    for (let v = 0; v < 256; v++) shiftLUT[v] = Math.floor(15 * v * depthMult / 255);

    const ctx = cnv.drawingContext;

    for (let y = 0; y < dH; y++) {
      const rowData = ctx.getImageData(0, y, outW, 1);
      const row = rowData.data;

      for (let o = 0; o < numStrips; o++) {
        const stripX = o * stripWidth;
        for (let x = 0; x < stripWidth; x++) {
          const di = 4 * ((y * dW) + (x + stripX));
          const depthVal = dpx[di];
          const shift = shiftLUT[depthVal];
          let srcX = x + stripX + shift;
          if (srcX < 0) srcX = 0;
          if (srcX >= outW) srcX = outW - 1;
          const dstX = x + stripWidth + stripX;
          const si = (srcX << 2);
          const di2 = (dstX << 2);
          row[di2] = row[si];
          row[di2 + 1] = row[si + 1];
          row[di2 + 2] = row[si + 2];
          row[di2 + 3] = 255;
        }
      }

      ctx.putImageData(rowData, 0, y);
    }

    resolve(cnv.get());
  });
}

// --------------------------------------------
// ANIMATION + SAVE
// --------------------------------------------
function playAnimation() {
  if (frames.length === 0) return;
  outputImgElement.hide();
  currentFrame = 0;
  animPlaying = true;

  const showNext = () => {
    if (!animPlaying || frames.length === 0) return;
    outputImgElement.attribute('src', frames[currentFrame].canvas.toDataURL('image/jpeg'));
    outputImgElement.show();
    currentFrame = (currentFrame + 1) % frames.length;
    setTimeout(showNext, frameInterval);
  };

  showNext();
}

function saveAllFrames() {
  if (frames.length === 0) return;
  for (let i = 0; i < frames.length; i++) {
    let frame = frames[i];
    frame.save(`stereo_${nf(i, 3)}.jpg`);
  }
}

// async function saveAsGif() {
//   if (frames.length === 0) {
//     alert("Please generate an animated stereogram first!");
//     return;
//   }

//   let fps = parseFloat(prompt("Enter desired frame rate (frames per second):", "10"));
//   if (isNaN(fps) || fps <= 0) {
//     alert("Invalid frame rate.");
//     return;
//   }

//   // const gif = new GIF({
//   //   workers: 2,
//   //   quality: 10,
//   //   workerScript: 'https://cdn.jsdelivr.net/gh/jnordberg/gif.js/dist/gif.worker.js'
//   // });
//   // Embed gif.worker.js manually to bypass CORS
//   const workerCode = `
//     importScripts('https://cdn.jsdelivr.net/gh/jnordberg/gif.js/dist/gif.js');
//   `;
//   const blob = new Blob([workerCode], { type: "application/javascript" });
//   const workerURL = URL.createObjectURL(blob);

//   const gif = new GIF({
//     workers: 2,
//     quality: 10,
//     workerScript: workerURL
//   });

//   for (let i = 0; i < frames.length; i++) {
//     gif.addFrame(frames[i].canvas, { delay: 1000 / fps });
//   }

//   gif.on('finished', blob => {
//     saveAs(blob, 'animated_stereogram.gif');
//   });

//   gif.render();
// }
async function saveAsGif() {
  if (frames.length === 0) {
    alert("Please generate an animated stereogram first!");
    return;
  }

  let fps = parseFloat(prompt("Enter desired frame rate (frames per second):", "10"));
  if (isNaN(fps) || fps <= 0) {
    alert("Invalid frame rate.");
    return;
  }

  const capturer = new CCapture({
    format: 'gif',
    workersPath: '',
    framerate: fps,
    verbose: true,
    quality: 100
  });

  // Start capturing
  capturer.start();

  for (let i = 0; i < frames.length; i++) {
    // draw each frame to a temp canvas
    const temp = createGraphics(frames[i].width, frames[i].height);
    temp.image(frames[i], 0, 0);
    capturer.capture(temp.elt);
    temp.remove(); // cleanup to save memory
    await new Promise(r => setTimeout(r, 1000 / fps)); // small delay to simulate frame timing
  }

  capturer.stop();

  capturer.save(function (blob) {
    console.log('✅ GIF saved successfully');
  });
}

// --------------------------------------------
// HELPERS
// --------------------------------------------
function createLabeledInput(label, defaultValue, parentDiv) {
  let container = createDiv().style('display', 'flex')
    .style('flex-direction', 'column')
    .style('align-items', 'center');
  createSpan(label).style('margin-bottom', '5px').parent(container);
  let input = createInput(defaultValue, 'number')
    .style('width', '100px')
    .parent(container);
  parentDiv.child(container);
  return input;
}
