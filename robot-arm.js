"use strict";

var canvas, gl, program;

var NumVertices = 36; //(6 faces)(2 triangles/face)(3 vertices/triangle)

var points = [];
var colors = [];
var normals = [];

var vertices = [
  vec4(-0.5, -0.5, 0.5, 1.0),
  vec4(-0.5, 0.5, 0.5, 1.0),
  vec4(0.5, 0.5, 0.5, 1.0),
  vec4(0.5, -0.5, 0.5, 1.0),
  vec4(-0.5, -0.5, -0.5, 1.0),
  vec4(-0.5, 0.5, -0.5, 1.0),
  vec4(0.5, 0.5, -0.5, 1.0),
  vec4(0.5, -0.5, -0.5, 1.0),
];

// RGBA colors
var vertexColors = [
  vec4(0.0, 0.0, 0.0, 1.0), // black
  vec4(1.0, 0.0, 0.0, 1.0), // red
  vec4(1.0, 1.0, 0.0, 1.0), // yellow
  vec4(0.0, 1.0, 0.0, 1.0), // green
  vec4(0.0, 0.0, 1.0, 1.0), // blue
  vec4(1.0, 0.0, 1.0, 1.0), // magenta
  vec4(1.0, 0.6, 0.0, 1.0), // orange
  vec4(0.0, 1.0, 1.0, 1.0), // cyan
];

const Normals = {
  Up: vec3(0.0, 1.0, 0.0), // Up
  Down: vec3(0.0, -1.0, 0.0), // Down
  Left: vec3(-1.0, 0.0, 0.0), // Left
  Right: vec3(0.0, 0.0, 1.0), // Right
  Back: vec3(0.0, 0.0, -1.0), // Back
  Front: vec3(0.0, 1.0 , 1.0), // Front
};

// Parameters controlling the size of the Robot's arm

var BASE_HEIGHT = 1.0;
var BASE_WIDTH = 7.0;

// values
var cameraPosition = [200, 100, 300]; //eye/camera coordinates
var UpVector = [0, 1, 0]; //up vector
var fPosition = [0, 35, 0]; //at 

var fRotationRadians = 0;

// Shader transformation matrices
var modelViewMatrix;

var projectionMatrix;
var cameraMatrix;
var viewMatrix;

var worldViewProjectionLocation;
var worldInverseTransposeLocation;
var reverseLightDirectionLocation;

var worldMatrix
var viewProjectionMatrix
var worldViewProjectionMatrix;
var worldInverseMatrix;
var worldInverseTransposeMatrix;
// Array of rotation angles (in degrees) for each rotation axis

const defaultTheta = {
  BASE: 45,
  ARM1: 20,
  ARM2: -40,
  ARM3: 130,
  ARM4: 20,
  ARM5: 0,
  CLAW1: -30,
  CLAW2: -30,
  CLAW3: 30,
  CLAW4: 30,
};

// Copy of defaultTheta
var theta = Object.assign({}, defaultTheta); 

var angle = 0;

var modelViewMatrixLoc;

var vBuffer, cBuffer;

const Phase = {
  BaseSpin: 0,
  TopCraneLower: 1,
  BottomCraneLower: 2,
  ClawGrab: 3,
  BottomCraneRaise: 4,
  TopCraneRaise: 5,
  ClawRelease: 6,
};

const Actions = {
  AutoAnimate: true,
  BaseRotateLeft: false,
  BaseRotateRight: false,
  CraneLower: false,
  CraneRaise: false,
  ClawGrab: false,
  ClawRelease: false,
};

const vel = 0.5;
let currentPhase = Phase.BaseSpin;

const baseButtons = document.querySelector(".base-btns").children;
const craneButtons = document.querySelector(".crane-btns").children;
const clawButtons = document.querySelector(".claw-btns").children;

(async () => {
  await init();
})();

// Util Functions

function crossProduct(v1, v2) {
  return vec3(
    v1[1]*v2[2] - v1[2] * v2[1],
    v1[2]*v2[0] - v1[0] * v2[2],
    v1[0]*v2[1] - v1[1] * v2[0],
  )
}

// Calculate normal vector from quad surface
function calculateNormal(v1,v2,v3,_v4) {
  return crossProduct((v2-v1), (v3 -v1))
}

function radToDeg(r) {
  return r * 180 / Math.PI;
}

function degToRad(d) {
  return d * Math.PI / 180;
}

//----------------------------------------------------------------------------

function quad(a, b, c, d) {
  colors.push(vertexColors[2]);
  colors.push(vertexColors[2]);
  colors.push(vertexColors[2]);
  colors.push(vertexColors[2]);
  colors.push(vertexColors[2]);
  colors.push(vertexColors[2]);
  points.push(vertices[a]);
  points.push(vertices[b]);
  points.push(vertices[c]);
  points.push(vertices[a]);
  points.push(vertices[c]);
  points.push(vertices[d]);

}

function setNormal(normal) {
  for (let i = 0; i < 6; i++) {
    normals.push(normal)
  }
}

function colorCube() {
  quad(1, 0, 3, 2);
  setNormal(Normals.Front)
  quad(2, 3, 7, 6);
  setNormal(Normals.Right)
  quad(3, 0, 4, 7);
  setNormal(Normals.Down)
  quad(6, 5, 1, 2);
  setNormal(Normals.Up)
  quad(4, 5, 6, 7);
  setNormal(Normals.Back)
  quad(5, 4, 0, 1);
  setNormal(Normals.Left)
}

//--------------------------------------------------

function disableInputs(inputs) {
  Array.from(inputs).forEach((el) => {
    el.disabled = true;
  });
}

function enableInputs(inputs) {
  Array.from(inputs).forEach((el) => {
    el.disabled = false;
  });
}

function setButtonListeners(buttons) {
  Array.from(buttons).forEach((el) => {
    const id = el.getAttribute("id");
    el.addEventListener("click", () => {
      Actions[id] = true;
      disableInputs(buttons);
    });
  });
}

function renderToolBar() {
  const sliders = document.querySelectorAll(".form-range");
  const buttons = document.querySelectorAll(".action-btn");
  sliders.forEach((el) => {
    const id = el.getAttribute("id");
    el.addEventListener("click", (e) => {
      theta[id] = e.target.value;
    });
  });

  disableInputs(buttons)
  disableInputs(sliders)

  const toggleAutoAnimate = document.getElementById('AutoAnimate')
  toggleAutoAnimate.addEventListener('change', (e) => {
    theta = Object.assign({}, defaultTheta);
    Actions.AutoAnimate = e.target.checked
    if (e.target.checked) {
      disableInputs(buttons)
      disableInputs(sliders)
    } else {
      enableInputs(buttons)
      enableInputs(sliders)
    }
  })

  setButtonListeners(baseButtons);
  setButtonListeners(craneButtons);
  setButtonListeners(clawButtons);
}

async function init() {
  canvas = document.getElementById("gl-canvas");

  gl = canvas.getContext("webgl2");
  if (!gl) {
    alert("WebGL 2.0 isn't available");
  }

  gl.viewport(0, 0, canvas.width, canvas.height);

  gl.clearColor(1.0, 1.0, 1.0, 1.0);

	gl.enable(gl.CULL_FACE); //enable depth buffer
  gl.enable(gl.DEPTH_TEST);

  // inital default
  fRotationRadians = degToRad(0);
  var FOV_Radians = degToRad(60);
  var aspect = canvas.width / canvas.height;
  var zNear = 1;
  var zFar = 2000;

  projectionMatrix = m4.perspective(FOV_Radians, aspect, zNear, zFar); //setup perspective viewing volume

  //
  //  Load shaders and initialize attribute buffers
  //
  program = initShaders(gl, "vertex-shader", "fragment-shader");

  gl.useProgram(program);

  colorCube();

  // Load shaders and use the resulting shader program

  program = initShaders(gl, "vertex-shader", "fragment-shader");
  gl.useProgram(program);

  // Create and initialize  buffer objects

  vBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);

  var positionLoc = gl.getAttribLocation(program, "aPosition");
  gl.vertexAttribPointer(positionLoc, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(positionLoc);

  cBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);

  var colorLoc = gl.getAttribLocation(program, "aColor");
  gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(colorLoc);

  var nBuffer = gl.createBuffer();
  gl.bindBuffer( gl.ARRAY_BUFFER, nBuffer );
  gl.bufferData(gl.ARRAY_BUFFER, flatten(normals), gl.STATIC_DRAW);

  var normalLocation = gl.getAttribLocation(program, "a_normal");
  gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, 0, 0); 
  gl.enableVertexAttribArray( normalLocation );

	worldViewProjectionLocation = gl.getUniformLocation(program, "u_worldViewProjection");
  modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
  worldInverseTransposeLocation = gl.getUniformLocation(program, "u_worldInverseTranspose");
	reverseLightDirectionLocation =  gl.getUniformLocation(program, "u_reverseLightDirection");

  projectionMatrix = ortho(-10, 10, -10, 10, -10, 10);
  gl.uniformMatrix4fv(
    gl.getUniformLocation(program, "projectionMatrix"),
    false,
    flatten(projectionMatrix)
  );

  renderToolBar();
  render();
}

// Animations

function nextAnimation() {
  if (Actions.AutoAnimate) {
    return autoAnimate()
  }

  if (Actions.BaseRotateLeft) {
    theta.BASE += vel;
    if (theta.BASE % 45 == 0) {
      Actions.BaseRotateLeft = false;
      enableInputs(baseButtons);
    }
  }

  if (Actions.BaseRotateRight) {
    theta.BASE -= vel;
    if (theta.BASE % 45 == 0) {
      Actions.BaseRotateRight = false;
      enableInputs(baseButtons);
    }
  }

  if (Actions.CraneLower) {
    if (theta.ARM1 < 40) {
      theta.ARM1 += vel*0.6;
    }
    if (theta.ARM4 < 50) {
      theta.ARM4 += vel*0.6;
    }
    if (theta.ARM1 >= 40 && theta.ARM4 >= 50) {
      Actions.CraneLower = false;
      enableInputs(craneButtons);
    }
  }
  if (Actions.CraneRaise) {
    if (theta.ARM1 > 20) {
      theta.ARM1 -= vel*0.6;
    }
    if (theta.ARM4 > 20) {
      theta.ARM4 -= vel*0.6;
    }
    if (theta.ARM1 <= 20 && theta.ARM4 <= 20) {
      Actions.CraneRaise = false;
      enableInputs(craneButtons);
    }
  }

  if (Actions.ClawGrab) {
    if (theta.CLAW1 >= 0 || theta.CLAW4 <= 0) {
      Actions.ClawGrab = false;
      enableInputs(clawButtons);
    }
    theta.CLAW1 += vel;
    theta.CLAW2 += vel;
    theta.CLAW3 -= vel;
    theta.CLAW4 -= vel;
  }

  if (Actions.ClawRelease) {
    if (theta.CLAW1 <= -30 || theta.CLAW4 >= 30) {
      Actions.ClawRelease = false;
      enableInputs(clawButtons);
    }
    theta.CLAW1 -= vel;
    theta.CLAW2 -= vel;
    theta.CLAW3 += vel;
    theta.CLAW4 += vel;
  }
}

function autoAnimate() {
  switch (currentPhase) {
    case Phase.BaseSpin:
      theta.BASE += vel;
      if (theta.BASE % 45 == 0) {
        currentPhase = Phase.TopCraneLower;
      }
      break;
    case Phase.TopCraneLower:
      if (theta.ARM1 >= 40) {
        currentPhase = Phase.BottomCraneLower;
      }
      theta.ARM1 += vel;
      break;
    case Phase.BottomCraneLower:
      if (theta.ARM4 >= 50) {
        currentPhase = Phase.ClawGrab;
      }
      theta.ARM4 += vel;
      break;
    case Phase.ClawGrab:
      if (theta.CLAW1 >= 0 || theta.CLAW4 <= 0) {
        currentPhase = Phase.BottomCraneRaise;
      }
      theta.CLAW1 += vel;
      theta.CLAW2 += vel;
      theta.CLAW3 -= vel;
      theta.CLAW4 -= vel;
      break;
    case Phase.BottomCraneRaise:
      if (theta.ARM4 <= 20) {
        currentPhase = Phase.TopCraneRaise;
      }
      theta.ARM4 -= vel;
      break;
    case Phase.TopCraneRaise:
      if (theta.ARM1 <= 20) {
        currentPhase = Phase.ClawRelease;
      }
      theta.ARM1 -= vel;
      break;
    case Phase.ClawRelease:
      if (theta.CLAW1 <= -30 || theta.CLAW4 >= 30) {
        currentPhase = Phase.BaseSpin;
      }
      theta.CLAW1 -= vel;
      theta.CLAW2 -= vel;
      theta.CLAW3 += vel;
      theta.CLAW4 += vel;
      break;
    default:
      break;
  }
}

//----------------------------------------------------------------------------

function base() {
  var s = scale(BASE_WIDTH, BASE_HEIGHT, BASE_WIDTH);
  var instanceMatrix = mult(translate(0.0, 0.5 * BASE_HEIGHT, 0.0), s);

  var t = mult(modelViewMatrix, instanceMatrix);
  gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(t));
  gl.drawArrays(gl.TRIANGLES, 0, NumVertices);
}

//----------------------------------------------------------------------------

function arm({ width, height } = {}) {
  var s = scale(width, height, width);
  var instanceMatrix = mult(translate(0.0, 0.5 * height, 0.0), s);

  var t = mult(modelViewMatrix, instanceMatrix);
  gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(t));
  gl.drawArrays(gl.TRIANGLES, 0, NumVertices);
}

//----------------------------------------------------------------------------

function render() {
  // Compute the camera's matrix using look at.
  cameraMatrix = m4.lookAt(cameraPosition, fPosition, UpVector);

  // Make a view matrix from the camera matrix
  viewMatrix = m4.inverse(cameraMatrix);
	
	// Compute a view projection matrix
	viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);

  worldMatrix = m4.yRotation(fRotationRadians);

  // Multiply the matrices.
  worldViewProjectionMatrix = m4.multiply(projectionMatrix, worldMatrix);
  worldInverseMatrix = m4.inverse(worldMatrix);
  worldInverseTransposeMatrix = m4.transpose(worldInverseMatrix);

  // Set the matrices
  gl.uniformMatrix4fv(worldViewProjectionLocation, false, worldViewProjectionMatrix);
  gl.uniformMatrix4fv(worldInverseTransposeLocation, false, worldInverseTransposeMatrix);

  // set the light direction.
  gl.uniform3fv(reverseLightDirectionLocation, m4.normalize([-0.5, 1.0, 1]));
  // gl.uniform3fv(reverseLightDirectionLocation, [-50, 50, 60]);

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  modelViewMatrix = translate(0, -5, 0);

  // base
  modelViewMatrix = mult(modelViewMatrix, translate(0.0, 0, 0.0));
  modelViewMatrix = mult(modelViewMatrix, rotate(theta.BASE, vec3(0, 1, 0)));
  base();

  modelViewMatrix = mult(modelViewMatrix, translate(0.0, BASE_HEIGHT, 0.0));
  modelViewMatrix = mult(modelViewMatrix, rotate(theta.ARM1, vec3(0, 0, 1)));

  // arm 1
  arm({ width: 1.5, height: 3 });

  modelViewMatrix = mult(modelViewMatrix, translate(0.0, 3, 0.0));
  modelViewMatrix = mult(modelViewMatrix, rotate(theta.ARM2, vec3(0, 0, 1)));

  // arm 2
  arm({ width: 1.5, height: 5 });

  modelViewMatrix = mult(modelViewMatrix, translate(0.0, 5, 0.0));
  modelViewMatrix = mult(modelViewMatrix, rotate(theta.ARM3, vec3(0, 0, 1)));

  // arm 3
  arm({ width: 1.5, height: 5 });

  modelViewMatrix = mult(modelViewMatrix, translate(0.0, 5, 0.0));
  modelViewMatrix = mult(modelViewMatrix, rotate(theta.ARM4, vec3(0, 0, 1)));

  // arm 4
  arm({ width: 1.5, height: 2 });

  modelViewMatrix = mult(modelViewMatrix, translate(0.0, 2, 0.0));
  modelViewMatrix = mult(modelViewMatrix, rotate(theta.ARM5, vec3(0, 0, 1)));

  let clawBaseModelViewMatrix = modelViewMatrix;

  // arm 5 (claw base)
  arm({ width: 3, height: 0.5 });

  modelViewMatrix = mult(modelViewMatrix, translate(-1, 0.5, -1));
  modelViewMatrix = mult(modelViewMatrix, rotate(theta.CLAW1, vec3(0, 0, 1)));

  // claw 1a
  arm({ width: 1, height: 1 });

  modelViewMatrix = mult(modelViewMatrix, translate(0, 1, 0));
  modelViewMatrix = mult(modelViewMatrix, rotate(20, vec3(0, 0, 1)));

  // claw 1b
  arm({ width: 1, height: 1 });

  modelViewMatrix = clawBaseModelViewMatrix;
  modelViewMatrix = mult(modelViewMatrix, translate(-1, 0.5, 1));
  modelViewMatrix = mult(modelViewMatrix, rotate(theta.CLAW2, vec3(0, 0, 1)));

  // claw 2a
  arm({ width: 1, height: 1 });

  modelViewMatrix = mult(modelViewMatrix, translate(0, 1, 0));
  modelViewMatrix = mult(modelViewMatrix, rotate(20, vec3(0, 0, 1)));

  // claw 2b
  arm({ width: 1, height: 1 });

  modelViewMatrix = clawBaseModelViewMatrix;
  modelViewMatrix = mult(modelViewMatrix, translate(1, 0.5, 1));
  modelViewMatrix = mult(modelViewMatrix, rotate(theta.CLAW3, vec3(0, 0, 1)));

  // claw 3a
  arm({ width: 1, height: 1 });

  modelViewMatrix = mult(modelViewMatrix, translate(0, 1, 0));
  modelViewMatrix = mult(modelViewMatrix, rotate(-20, vec3(0, 0, 1)));

  // claw 3b
  arm({ width: 1, height: 1 });

  modelViewMatrix = clawBaseModelViewMatrix;
  modelViewMatrix = mult(modelViewMatrix, translate(1, 0.5, -1));
  modelViewMatrix = mult(modelViewMatrix, rotate(theta.CLAW4, vec3(0, 0, 1)));

  // claw 4a
  arm({ width: 1, height: 1 });

  modelViewMatrix = mult(modelViewMatrix, translate(0, 1, 0));
  modelViewMatrix = mult(modelViewMatrix, rotate(-20, vec3(0, 0, 1)));

  // claw 4b
  arm({ width: 1, height: 1 });

  nextAnimation();

  requestAnimationFrame(render);
}
