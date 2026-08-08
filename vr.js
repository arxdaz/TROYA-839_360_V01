/*
 * vr.js — WebXR (Meta Quest) viewer for the equirectangular versions of the
 * same panoramas used by the Marzipano tour.
 *
 * Marzipano itself does not do stereo WebXR rendering, so this file runs a
 * completely separate, lightweight Three.js scene: a big inverted sphere
 * with the equirectangular photo mapped on the inside. When the person taps
 * "Ver en VR", a WebXR immersive-vr session is requested and the Quest
 * headset takes over the camera automatically. Scene switching inside the
 * headset is done by pointing a controller at one of four floating labels
 * and pulling the trigger.
 *
 * Requires: vendor/three.min.js loaded before this file, and index.js
 * loaded before this file (so window.__currentTourSceneId exists).
 */
'use strict';

(function() {
  if (typeof window.THREE === 'undefined') {
    console.warn('vr.js: THREE no está disponible, omitiendo soporte VR.');
    return;
  }

  var THREE = window.THREE;

  var vrToggleElement = document.querySelector('#vrToggle');
  var vrContainerElement = document.querySelector('#vrContainer');
  var vrUnsupportedNotice = document.querySelector('#vrUnsupportedNotice');

  if (!vrToggleElement || !vrContainerElement) {
    return;
  }

  // Map Marzipano scene ids -> equirectangular image used for VR.
  // These filenames must match the ones exported into img/equirect/.
  var SCENE_ORDER = ['0-recibidor', '1-sala', '2-cocina', '3-recamara'];
  var SCENE_LABELS = {
    '0-recibidor': 'RECIBIDOR',
    '1-sala': 'SALA',
    '2-cocina': 'COCINA',
    '3-recamara': 'RECAMARA'
  };
  var SCENE_IMAGES = {
    '0-recibidor': 'img/equirect/0-recibidor.jpg',
    '1-sala': 'img/equirect/1-sala.jpg',
    '2-cocina': 'img/equirect/2-cocina.jpg',
    '3-recamara': 'img/equirect/3-recamara.jpg'
  };

  var renderer = null;
  var scene = null;
  var camera = null;
  var sphere = null;
  var textureLoader = null;
  var menuGroup = null;
  var menuButtons = [];
  var controllers = [];
  var raycaster = new THREE.Raycaster();
  var tempMatrix = new THREE.Matrix4();
  var xrSession = null;
  var currentSceneId = null;
  var pendingSceneId = null;

  // ---------------------------------------------------------------------
  // Feature detection: only show the VR button if the browser (Quest
  // Browser) actually supports an immersive-vr session.
  // ---------------------------------------------------------------------
  function checkXrSupport() {
    if (!navigator.xr || !navigator.xr.isSessionSupported) {
      return;
    }
    navigator.xr.isSessionSupported('immersive-vr').then(function(supported) {
      if (supported) {
        document.body.classList.add('vr-supported');
      }
    }).catch(function() {
      // Silently ignore — button just stays hidden.
    });
  }
  checkXrSupport();

  // ---------------------------------------------------------------------
  // Renderer / scene setup (created once, lazily, on first VR entry).
  // ---------------------------------------------------------------------
  function initThree() {
    if (renderer) {
      return;
    }

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    renderer.domElement.id = 'vrCanvas';
    vrContainerElement.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);

    var geometry = new THREE.SphereGeometry(500, 60, 40);
    // Flip the sphere inside-out so the texture is visible from inside it.
    geometry.scale(-1, 1, 1);
    var material = new THREE.MeshBasicMaterial();
    sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    textureLoader = new THREE.TextureLoader();

    menuGroup = new THREE.Group();
    menuGroup.position.set(0, -0.3, -2.2);
    scene.add(menuGroup);
    buildMenu();

    setupControllers();

    window.addEventListener('resize', onWindowResize);

    renderer.setAnimationLoop(renderFrame);
  }

  function onWindowResize() {
    if (!renderer || !camera) {
      return;
    }
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ---------------------------------------------------------------------
  // Floating scene-switch menu (simple canvas-texture labels).
  // ---------------------------------------------------------------------
  function makeLabelTexture(text, highlighted) {
    var canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    var ctx = canvas.getContext('2d');

    ctx.fillStyle = highlighted ? 'rgba(255,255,255,0.95)' : 'rgba(20,20,20,0.8)';
    roundRect(ctx, 4, 4, canvas.width - 8, canvas.height - 8, 22);
    ctx.fill();

    ctx.font = '600 46px "Century Gothic", Poppins, Arial, sans-serif';
    ctx.fillStyle = highlighted ? '#111111' : '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);

    var texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function buildMenu() {
    var spacing = 0.58;
    var startX = -((SCENE_ORDER.length - 1) * spacing) / 2;

    SCENE_ORDER.forEach(function(id, i) {
      var geometry = new THREE.PlaneGeometry(0.5, 0.125);
      var material = new THREE.MeshBasicMaterial({
        map: makeLabelTexture(SCENE_LABELS[id], false),
        transparent: true,
        depthTest: false
      });
      var mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(startX + i * spacing, 0.18, 0);
      mesh.userData.sceneId = id;
      menuGroup.add(mesh);
      menuButtons.push(mesh);
    });

    var exitGeometry = new THREE.PlaneGeometry(0.42, 0.11);
    var exitMaterial = new THREE.MeshBasicMaterial({
      map: makeLabelTexture('SALIR', false),
      transparent: true,
      depthTest: false
    });
    var exitMesh = new THREE.Mesh(exitGeometry, exitMaterial);
    exitMesh.position.set(0, -0.05, 0);
    exitMesh.userData.action = 'exit';
    menuGroup.add(exitMesh);
    menuButtons.push(exitMesh);
  }

  function setButtonHighlighted(mesh, highlighted) {
    var label = mesh.userData.action === 'exit' ? 'SALIR' : SCENE_LABELS[mesh.userData.sceneId];
    mesh.material.map = makeLabelTexture(label, highlighted);
    mesh.material.needsUpdate = true;
  }

  // ---------------------------------------------------------------------
  // Controllers (Meta Quest touch controllers) — point + trigger to pick.
  // ---------------------------------------------------------------------
  function setupControllers() {
    for (var i = 0; i < 2; i++) {
      var controller = renderer.xr.getController(i);
      controller.addEventListener('selectstart', onControllerSelect);
      scene.add(controller);

      var lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1)
      ]);
      var line = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: 0xffffff }));
      line.name = 'controllerRay';
      line.scale.z = 3;
      controller.add(line);

      controllers.push(controller);
    }
  }

  function getHoveredButton(controller) {
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
    var intersects = raycaster.intersectObjects(menuButtons);
    return intersects.length > 0 ? intersects[0].object : null;
  }

  function onControllerSelect(event) {
    var hovered = getHoveredButton(event.target);
    if (!hovered) {
      return;
    }
    if (hovered.userData.action === 'exit') {
      exitVR();
    } else if (hovered.userData.sceneId) {
      loadScene(hovered.userData.sceneId);
    }
  }

  // ---------------------------------------------------------------------
  // Panorama loading.
  // ---------------------------------------------------------------------
  function loadScene(id) {
    var url = SCENE_IMAGES[id];
    if (!url || id === currentSceneId) {
      return;
    }
    pendingSceneId = id;
    textureLoader.load(
      url,
      function(texture) {
        if (pendingSceneId !== id) {
          return; // A newer request superseded this one.
        }
        if ('encoding' in texture) {
          texture.encoding = THREE.sRGBEncoding;
        }
        if (sphere.material.map) {
          sphere.material.map.dispose();
        }
        sphere.material.map = texture;
        sphere.material.needsUpdate = true;
        currentSceneId = id;
        pendingSceneId = null;
      },
      undefined,
      function(error) {
        console.error('vr.js: no se pudo cargar la panorámica', url, error);
        pendingSceneId = null;
      }
    );
  }

  function renderFrame() {
    // Simple hover highlight for whichever controller is pointing at a button.
    menuButtons.forEach(function(btn) { btn.userData.hoveredThisFrame = false; });
    controllers.forEach(function(controller) {
      var hovered = getHoveredButton(controller);
      if (hovered) {
        hovered.userData.hoveredThisFrame = true;
      }
    });
    menuButtons.forEach(function(btn) {
      var shouldHighlight = !!btn.userData.hoveredThisFrame;
      if (btn.userData.isHighlighted !== shouldHighlight) {
        btn.userData.isHighlighted = shouldHighlight;
        setButtonHighlighted(btn, shouldHighlight);
      }
    });

    renderer.render(scene, camera);
  }

  // ---------------------------------------------------------------------
  // Session lifecycle.
  // ---------------------------------------------------------------------
  function getStartingSceneId() {
    if (window.__currentTourSceneId && SCENE_IMAGES[window.__currentTourSceneId]) {
      return window.__currentTourSceneId;
    }
    return SCENE_ORDER[0];
  }

  function enterVR() {
    initThree();
    loadScene(getStartingSceneId());

    navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] })
      .then(function(session) {
        xrSession = session;
        document.body.classList.add('vr-active');
        renderer.xr.setSession(session);
        session.addEventListener('end', onSessionEnd);
      })
      .catch(function(err) {
        console.error('vr.js: no se pudo iniciar la sesión WebXR', err);
      });
  }

  function exitVR() {
    if (xrSession) {
      xrSession.end();
    }
  }

  function onSessionEnd() {
    document.body.classList.remove('vr-active');
    xrSession = null;
  }

  // Keep the VR viewer's panorama in sync if the person switches scenes
  // in the regular browser view right before putting the headset on.
  window.__onTourSceneChange = function(sceneId) {
    if (!xrSession && sphere) {
      currentSceneId = null; // force a reload next time VR is entered
    }
  };

  vrToggleElement.addEventListener('click', function() {
    if (!navigator.xr) {
      if (vrUnsupportedNotice) {
        vrUnsupportedNotice.classList.add('visible');
      }
      return;
    }
    enterVR();
  });

  var vrNoticeClose = document.querySelector('.vrNotice-close');
  if (vrNoticeClose) {
    vrNoticeClose.addEventListener('click', function() {
      vrUnsupportedNotice.classList.remove('visible');
    });
  }

})();
