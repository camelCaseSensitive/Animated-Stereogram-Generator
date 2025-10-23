// --- Animated Stereogram Generator ---
// Supports multiple depth maps + multiple textures to make looping stereogram animations.
// Works fully on GitHub Pages or local server (CORS OK for gif.js).

let depthImgs = [];    // array of depth maps
let textureImgs = [];  // array of textures
let frames = [];       // generated stereogram frames
let currentFrame = 0;
let animPlaying = false;
let frameInterval = 150; // ms per frame
let outputImgElement;

let numStripsInput, depthMultInput, imgScaleInput;
let tileTextureCheckbox, mirrorTilesCheckbox;
let generateButton, saveButton, saveGifButton;

let depthZone, textureZone;

// --- p5.js setup ---
function setup() {
  noCanvas();
  createElement('h1', 'Animated Stereogram Generator').style('text-align', 'center');

  // --- Drop Zones ---
  const dropContainer = createDiv().style('display', 'flex')
    .style('justify-content', 'center')
    .style('gap', '20px')
    .style('flex-wrap', 'wrap')
    .style('margin-bottom', '20px');

  depthZone = createDropZone('Drop Depth Maps Here', gotDepthFiles);
  textureZone = createDropZone('Drop Textures Here', gotTextureFiles);
  dropContainer.child(depthZone.container);
  dropContainer.child(textureZone.container);

  // --- Input Controls ---
  const inputContainer = createDiv().style('display', 'flex')
    .style('justify-content', 'center')
    .style('gap', '20px')
    .style('margin-bottom', '20px')
    .style('flex-wrap', 'wrap');

  numStripsInput = createLabeledInput('Number of Strips', 6, inputContainer);
  depthMultInput = createLabeledInput('Depth Multiplier', 1.0, inputContainer);
  imgScaleInput = createLabeledInput('Image Scale', 1.0, inputContainer);

  // --- Tile & Mirror Checkboxes ---
  const tileContainer = createDiv().style('display', 'flex')
    .style('flex-direction', 'column')
    .style('align-items', 'center');
  createSpan('Tile Texture').style('margin-bottom', '5px').parent(tileContainer);
  tileTextureCheckbox = createCheckbox('', false).parent(tileContainer);
  inputContainer.child(tileContainer);

  const mirrorContainer = createDiv().style('display', 'flex')
    .style('flex-direction', 'column')
    .style('align-items', 'center');
  createSpan('Mirror Tiles').style('margin-bottom', '5px').parent(mirrorContainer);
  mirrorTilesCheckbox = createCheckbox('', false).parent(mirrorContainer);
  inputContainer.child(mirrorContainer);

  // --- Buttons ---
  const buttonContainer = createDiv().style('text-align', 'center').style('margin-bottom', '20px');
  generateButton = createButton('Generate Animated Stereogram').parent(buttonContainer);
  saveButton = createButton('Save Frames').parent(buttonContainer);
  saveGifButton = createButton('Save as GIF').parent(buttonContainer);

  generateButton.mousePressed(generateAnimatedStereograms);
  saveButton.mousePressed(saveAllFrames);
  saveGifButton.mousePressed(saveAsGif);

  saveButton.attribute('disabled', true);
  saveGifButton.attribute('disabled', true);

  // --- Output display ---
  createElement('h3', 'Output Animation').style('text-align', 'center').style('margin-top', '10px');

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

  createElement('footer', '© Copyright lavaboosted')
    .style('text-align', 'center')
    .style('margin-top', '40px')
    .style('padding', '10px')
    .style('font-size', '14px')
    .style('color', '#666');
}

// --- Drop Zones ---
function createDropZone(labelText, callback) {
  const container = createDiv()
    .style('border', '2px dashed #999')
    .style('padding', '40px')
    .style('text-align', 'center')
    .style('width', '240px')
    .style('height', '180px')
    .style('line-height', '160px')
    .style('cursor', 'pointer')
    .style('background-color', '#fafafa')
    .style('position', 'relative')
    .style('overflow', 'hidden');

  createSpan(labelText).parent(container);
  const fileInput = createFileInput(f => callback(f), true);
  fileInput.parent(container);
  fileInput.elt.multiple = true;
  fileInput.elt.style.display = 'none';

  container.mousePressed(() => fileInput.elt.click());
  container.dragOver(() => container.style('border-color', '#33aaff').style('background-color', '#e6f4ff'));
  container.dragLeave(() => container.style('border-color', '#999').style('background-color', '#fafafa'));
  container.drop(f => {
    container.style('border-color', '#999').style('background-color', '#fafafa');
    callback(f);
  });

  return { container, fileInput };
}

// --- File Loading + Sorting ---
function gotDepthFiles(files) {
  if (!Array.isArray(files)) files = [files];
  showLoadingMessage(depthZone, "Loading depth maps...");

  const promises = files.filter(f => f.type === 'image').map(f =>
    new Promise(resolve => loadImage(f.data, img => resolve({ name: f.name, img })))
  );

  Promise.all(promises).then(loaded => {
    loaded.sort((a, b) => extractFrameNumber(a.name) - extractFrameNumber(b.name));
    depthImgs.push(...loaded.map(l => l.img));
    displayPreviewGrid(depthZone, depthImgs);
    console.log(`✅ Loaded ${depthImgs.length} depth maps.`);
  });
}

function gotTextureFiles(files) {
  if (!Array.isArray(files)) files = [files];
  showLoadingMessage(textureZone, "Loading textures...");

  const promises = files.filter(f => f.type === 'image').map(f =>
    new Promise(resolve => loadImage(f.data, img => resolve({ name: f.name, img })))
  );

  Promise.all(promises).then(loaded => {
    loaded.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    textureImgs.push(...loaded.map(l => l.img));
    displayPreviewGrid(textureZone, textureImgs);
    console.log(`✅ Loaded ${textureImgs.length} textures.`);
  });
}

function extractFrameNumber(name) {
  const match = name.match(/(\d+)(?=\.[^.]+$)/);
  return match ? parseInt(match[1]) : 0;
}

// --- Visual Feedback ---
function showLoadingMessage(zone, msg) {
  zone.container.html('');
  createP(msg)
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
  const grid = createDiv().style('display', 'grid')
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

// --- Main Generation ---
async function generateAnimatedStereograms() {
  if (depthImgs.length === 0 || textureImgs.length === 0) {
    alert("Please upload depth maps and textures first.");
    return;
  }

  const numStrips = int(numStripsInput.value());
  const depthMult = float(depthMultInput.value());
  const imgScale = float(imgScaleInput.value());
  const tileTexture = tileTextureCheckbox.checked();
  const mirrorTiles = mirrorTilesCheckbox.checked();

  frames = [];

  for (let i = 0; i < depthImgs.length; i++) {
    const depth = depthImgs[i];
    const tex = textureImgs[i % textureImgs.length];
    console.log(`🎨 Generating frame ${i + 1}/${depthImgs.length}`);
    const frame = await generateSingleStereogram(depth, tex, numStrips, depthMult, imgScale, tileTexture, mirrorTiles);
    frames.push(frame);
  }

  console.log(`✅ Generated ${frames.length} frames.`);
  playAnimation();
  saveButton.removeAttribute('disabled');
  saveGifButton.removeAttribute('disabled');
}

// --- Single Frame Generator ---
async function generateSingleStereogram(depthImg, textureImg, numStrips, depthMult, imgScale, tileTexture, mirrorTiles) {
  return new Promise(resolve => {
    const depthCopy = depthImg.get();
    depthCopy.resize(depthCopy.width * imgScale, depthCopy.height * imgScale);

    const stripWidth = Math.floor(depthCopy.width / numStrips);
    const stripHeight = depthCopy.height;

    const cnv = createGraphics(depthCopy.width + stripWidth, stripHeight);
    cnv.pixelDensity(1);
    cnv.noSmooth();

    let texSrc = textureImg.get();

    if (tileTexture) {
      const targetW = Math.ceil(stripWidth * 1.1);
      const targetH = Math.round(texSrc.height * targetW / texSrc.width);
      texSrc.resize(targetW, targetH);

      const tiled = createGraphics(texSrc.width, stripHeight);
      tiled.noSmooth();
      const copies = Math.ceil(stripHeight / texSrc.height);
      for (let i = 0; i < copies; i++) {
        if (mirrorTiles && i % 2 === 1) {
          tiled.push();
          tiled.translate(0, (i + 1) * texSrc.height);
          tiled.scale(1, -1);
          tiled.image(texSrc, 0, 0);
          tiled.pop();
        } else {
          tiled.image(texSrc, 0, i * texSrc.height);
        }
      }
      texSrc = tiled;
    }

    cnv.image(texSrc, 0, 0, stripWidth, stripHeight);
    depthCopy.loadPixels();

    const dpx = depthCopy.pixels;
    const dW = depthCopy.width;
    const dH = depthCopy.height;
    const outW = cnv.width;

    const ctx = cnv.drawingContext;
    const shiftLUT = new Int16Array(256);
    for (let v = 0; v < 256; v++) shiftLUT[v] = Math.floor(15 * v * depthMult / 255);

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

// --- Animation Preview ---
function playAnimation() {
  if (frames.length === 0) return;
  outputImgElement.hide();
  animPlaying = true;
  currentFrame = 0;

  const showNext = () => {
    if (!animPlaying || frames.length === 0) return;
    outputImgElement.attribute('src', frames[currentFrame].canvas.toDataURL('image/jpeg'));
    outputImgElement.show();
    currentFrame = (currentFrame + 1) % frames.length;
    setTimeout(showNext, frameInterval);
  };
  showNext();
}

// --- Save All Frames ---
function saveAllFrames() {
  if (frames.length === 0) return;
  for (let i = 0; i < frames.length; i++) {
    frames[i].save(`stereo_${nf(i, 3)}.jpg`);
  }
}

// --- Save as GIF (gif.js) ---
async function saveAsGif() {
  if (frames.length === 0) {
    alert("Please generate an animation first.");
    return;
  }

  let fps = parseFloat(prompt("Enter frame rate (frames per second):", "10"));
  if (isNaN(fps) || fps <= 0) {
    alert("Invalid frame rate.");
    return;
  }

  const gif = new GIF({
    workers: 2,
    quality: 10,
    workerScript: 'assets/gif.worker.js'
  });

  for (let i = 0; i < frames.length; i++) {
    gif.addFrame(frames[i].canvas, { delay: 1000 / fps });
  }

  gif.on('progress', p => console.log(`GIF progress: ${Math.round(p * 100)}%`));

  // gif.on('finished', blob => {
  //   saveAs(blob, 'animated_stereogram.gif');
  //   console.log('✅ GIF saved.');
  // });

  // gif.render();
  gif.on('finished', blob => {
    loadingContainer.hide();
    loadingText.hide();
  
    // Native save
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'animated_stereogram.gif';
    a.click();
    URL.revokeObjectURL(url);
  
    console.log("✅ GIF saved successfully!");
  });
  
  gif.render();
}

// --- Helpers ---
function createLabeledInput(label, def, parentDiv) {
  const container = createDiv().style('display', 'flex')
    .style('flex-direction', 'column')
    .style('align-items', 'center');
  createSpan(label).style('margin-bottom', '5px').parent(container);
  const input = createInput(def, 'number').style('width', '100px').parent(container);
  parentDiv.child(container);
  return input;
}
