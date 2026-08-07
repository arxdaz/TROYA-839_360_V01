/*
 * Copyright 2016 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

(function() {
  var Marzipano = window.Marzipano;
  var bowser = window.bowser;
  var screenfull = window.screenfull;
  var data = window.APP_DATA;

  // Grab elements from DOM.
  var panoElement = document.querySelector('#pano');
  var sceneNameElement = document.querySelector('#titleBar .sceneName');
  var sceneListElement = document.querySelector('#sceneList');
  var sceneElements = document.querySelectorAll('#sceneList .scene');
  var sceneListToggleElement = document.querySelector('#sceneListToggle');
  var autorotateToggleElement = document.querySelector('#autorotateToggle');
  var fullscreenToggleElement = document.querySelector('#fullscreenToggle');
  var welcomeScreenElement = document.querySelector('#welcomeScreen');
  var welcomeProjectNameElement = document.querySelector('#welcomeProjectName');
  var welcomeEnterButtonElement = document.querySelector('#welcomeEnterButton');
  var vrToggleElement = document.querySelector('#vrToggle');
  var vrScreenElement = document.querySelector('#vrScreen');
  var vrPanoLeftElement = document.querySelector('#vrPanoLeft');
  var vrPanoRightElement = document.querySelector('#vrPanoRight');
  var vrExitButtonElement = document.querySelector('#vrExitButton');
  var vrXRContainerElement = document.querySelector('#vrXRContainer');

  // Remember where #pano normally lives so it can be moved back after VR mode.
  var panoOriginalParent = panoElement.parentNode;
  var panoOriginalNextSibling = panoElement.nextSibling;

  // Detect desktop or mobile mode.
  if (window.matchMedia) {
    var setMode = function() {
      if (mql.matches) {
        document.body.classList.remove('desktop');
        document.body.classList.add('mobile');
      } else {
        document.body.classList.remove('mobile');
        document.body.classList.add('desktop');
      }
    };
    var mql = matchMedia("(max-width: 500px), (max-height: 500px)");
    setMode();
    mql.addListener(setMode);
  } else {
    document.body.classList.add('desktop');
  }

  // Detect whether we are on a touch device.
  document.body.classList.add('no-touch');
  window.addEventListener('touchstart', function() {
    document.body.classList.remove('no-touch');
    document.body.classList.add('touch');
  });

  // Use tooltip fallback mode on IE < 11.
  if (bowser.msie && parseFloat(bowser.version) < 11) {
    document.body.classList.add('tooltip-fallback');
  }

  // Viewer options.
  var viewerOpts = {
    controls: {
      mouseViewMode: data.settings.mouseViewMode
    }
  };

  // Initialize viewer.
  var viewer = new Marzipano.Viewer(panoElement, viewerOpts);

  // Creates a scene (source + geometry + view) on a given Marzipano viewer.
  // Used for the main tour and, in VR mode, for the mirrored right-eye viewer.
  function createSceneOnViewer(targetViewer, sceneData) {
    var urlPrefix = "tiles";
    var source = Marzipano.ImageUrlSource.fromString(
      urlPrefix + "/" + sceneData.id + "/{z}/{f}/{y}/{x}.jpg",
      { cubeMapPreviewUrl: urlPrefix + "/" + sceneData.id + "/preview.jpg" });
    var geometry = new Marzipano.CubeGeometry(sceneData.levels);

    var limiter = Marzipano.RectilinearView.limit.traditional(sceneData.faceSize, 100*Math.PI/180, 120*Math.PI/180);
    var view = new Marzipano.RectilinearView(sceneData.initialViewParameters, limiter);

    var scene = targetViewer.createScene({
      source: source,
      geometry: geometry,
      view: view,
      pinFirstLevel: true
    });

    return {
      data: sceneData,
      scene: scene,
      view: view
    };
  }

  // Create scenes.
  var scenes = data.scenes.map(function(sceneData) {
    var entry = createSceneOnViewer(viewer, sceneData);

    // Create link hotspots.
    sceneData.linkHotspots.forEach(function(hotspot) {
      var element = createLinkHotspotElement(hotspot);
      entry.scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

    // Create info hotspots.
    sceneData.infoHotspots.forEach(function(hotspot) {
      var element = createInfoHotspotElement(hotspot);
      entry.scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

    return entry;
  });

  // Set up autorotate, if enabled.
  var autorotate = Marzipano.autorotate({
    yawSpeed: 0.03,
    targetPitch: 0,
    targetFov: Math.PI/2
  });
  if (data.settings.autorotateEnabled) {
    autorotateToggleElement.classList.add('enabled');
  }

  // Set handler for autorotate toggle.
  autorotateToggleElement.addEventListener('click', toggleAutorotate);

  // Set up fullscreen mode, if supported.
  if (screenfull.enabled && data.settings.fullscreenButton) {
    document.body.classList.add('fullscreen-enabled');
    fullscreenToggleElement.addEventListener('click', function() {
      screenfull.toggle();
    });
    screenfull.on('change', function() {
      if (screenfull.isFullscreen) {
        fullscreenToggleElement.classList.add('enabled');
      } else {
        fullscreenToggleElement.classList.remove('enabled');
      }
    });
  } else {
    document.body.classList.add('fullscreen-disabled');
  }

  // Set handler for scene list toggle.
  sceneListToggleElement.addEventListener('click', toggleSceneList);

  // Start with the scene list open on desktop.
  if (!document.body.classList.contains('mobile')) {
    showSceneList();
  }

  // Set handler for scene switch.
  scenes.forEach(function(scene) {
    var el = document.querySelector('#sceneList .scene[data-id="' + scene.data.id + '"]');
    if (!el) {
      // No existe un <a class="scene" data-id="..."> en index.html para esta
      // escena de data.js. Revisa que ambos archivos vengan del mismo
      // export de Marzipano (los data-id deben coincidir exactamente).
      console.warn('DAZ tour: no se encontró el botón de sceneList para la escena "' + scene.data.id + '". Revisa que index.html tenga <a class="scene" data-id="' + scene.data.id + '">.');
      return;
    }
    el.addEventListener('click', function() {
      switchScene(scene);
      // On mobile, hide scene list after selecting a scene.
      if (document.body.classList.contains('mobile')) {
        hideSceneList();
      }
    });
  });

  // DOM elements for view controls.
  var viewUpElement = document.querySelector('#viewUp');
  var viewDownElement = document.querySelector('#viewDown');
  var viewLeftElement = document.querySelector('#viewLeft');
  var viewRightElement = document.querySelector('#viewRight');
  var viewInElement = document.querySelector('#viewIn');
  var viewOutElement = document.querySelector('#viewOut');

  // Dynamic parameters for controls.
  var velocity = 0.7;
  var friction = 3;

  // Associate view controls with elements.
  var controls = viewer.controls();
  controls.registerMethod('upElement',    new Marzipano.ElementPressControlMethod(viewUpElement,     'y', -velocity, friction), true);
  controls.registerMethod('downElement',  new Marzipano.ElementPressControlMethod(viewDownElement,   'y',  velocity, friction), true);
  controls.registerMethod('leftElement',  new Marzipano.ElementPressControlMethod(viewLeftElement,   'x', -velocity, friction), true);
  controls.registerMethod('rightElement', new Marzipano.ElementPressControlMethod(viewRightElement,  'x',  velocity, friction), true);
  controls.registerMethod('inElement',    new Marzipano.ElementPressControlMethod(viewInElement,  'zoom', -velocity, friction), true);
  controls.registerMethod('outElement',   new Marzipano.ElementPressControlMethod(viewOutElement, 'zoom',  velocity, friction), true);

  function sanitize(s) {
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;');
  }

  var currentSceneEntry = null;

  function switchScene(scene) {
    stopAutorotate();
    scene.view.setParameters(scene.data.initialViewParameters);
    scene.scene.switchTo();
    currentSceneEntry = scene;
    startAutorotate();
    updateSceneName(scene);
    updateSceneList(scene);
  }

  function updateSceneName(scene) {
    sceneNameElement.innerHTML = sanitize(scene.data.name);
  }

  function updateSceneList(scene) {
    for (var i = 0; i < sceneElements.length; i++) {
      var el = sceneElements[i];
      if (el.getAttribute('data-id') === scene.data.id) {
        el.classList.add('current');
      } else {
        el.classList.remove('current');
      }
    }
  }

  function showSceneList() {
    sceneListElement.classList.add('enabled');
    sceneListToggleElement.classList.add('enabled');
  }

  function hideSceneList() {
    sceneListElement.classList.remove('enabled');
    sceneListToggleElement.classList.remove('enabled');
  }

  function toggleSceneList() {
    sceneListElement.classList.toggle('enabled');
    sceneListToggleElement.classList.toggle('enabled');
  }

  function startAutorotate() {
    if (!autorotateToggleElement.classList.contains('enabled')) {
      return;
    }
    viewer.startMovement(autorotate);
    viewer.setIdleMovement(3000, autorotate);
  }

  function stopAutorotate() {
    viewer.stopMovement();
    viewer.setIdleMovement(Infinity);
  }

  function toggleAutorotate() {
    if (autorotateToggleElement.classList.contains('enabled')) {
      autorotateToggleElement.classList.remove('enabled');
      stopAutorotate();
    } else {
      autorotateToggleElement.classList.add('enabled');
      startAutorotate();
    }
  }

  function createLinkHotspotElement(hotspot) {

    // Create wrapper element to hold icon and tooltip.
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot');
    wrapper.classList.add('link-hotspot');

    // Create image element.
    var icon = document.createElement('img');
    icon.src = 'img/link.png';
    icon.classList.add('link-hotspot-icon');

    // Set rotation transform.
    var transformProperties = [ '-ms-transform', '-webkit-transform', 'transform' ];
    for (var i = 0; i < transformProperties.length; i++) {
      var property = transformProperties[i];
      icon.style[property] = 'rotate(' + hotspot.rotation + 'rad)';
    }

    // Add click event handler.
    wrapper.addEventListener('click', function() {
      switchScene(findSceneById(hotspot.target));
    });

    // Prevent touch and scroll events from reaching the parent element.
    // This prevents the view control logic from interfering with the hotspot.
    stopTouchAndScrollEventPropagation(wrapper);

    // Create tooltip element.
    var tooltip = document.createElement('div');
    tooltip.classList.add('hotspot-tooltip');
    tooltip.classList.add('link-hotspot-tooltip');
    tooltip.innerHTML = findSceneDataById(hotspot.target).name;

    wrapper.appendChild(icon);
    wrapper.appendChild(tooltip);

    return wrapper;
  }

  function createInfoHotspotElement(hotspot) {

    // Create wrapper element to hold icon and tooltip.
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot');
    wrapper.classList.add('info-hotspot');

    // Create hotspot/tooltip header.
    var header = document.createElement('div');
    header.classList.add('info-hotspot-header');

    // Create image element.
    var iconWrapper = document.createElement('div');
    iconWrapper.classList.add('info-hotspot-icon-wrapper');
    var icon = document.createElement('img');
    icon.src = 'img/info.png';
    icon.classList.add('info-hotspot-icon');
    iconWrapper.appendChild(icon);

    // Create title element.
    var titleWrapper = document.createElement('div');
    titleWrapper.classList.add('info-hotspot-title-wrapper');
    var title = document.createElement('div');
    title.classList.add('info-hotspot-title');
    title.innerHTML = hotspot.title;
    titleWrapper.appendChild(title);

    // Create close element.
    var closeWrapper = document.createElement('div');
    closeWrapper.classList.add('info-hotspot-close-wrapper');
    var closeIcon = document.createElement('img');
    closeIcon.src = 'img/close.png';
    closeIcon.classList.add('info-hotspot-close-icon');
    closeWrapper.appendChild(closeIcon);

    // Construct header element.
    header.appendChild(iconWrapper);
    header.appendChild(titleWrapper);
    header.appendChild(closeWrapper);

    // Create text element.
    var text = document.createElement('div');
    text.classList.add('info-hotspot-text');
    text.innerHTML = hotspot.text;

    // Place header and text into wrapper element.
    wrapper.appendChild(header);
    wrapper.appendChild(text);

    // Create a modal for the hotspot content to appear on mobile mode.
    var modal = document.createElement('div');
    modal.innerHTML = wrapper.innerHTML;
    modal.classList.add('info-hotspot-modal');
    document.body.appendChild(modal);

    var toggle = function() {
      wrapper.classList.toggle('visible');
      modal.classList.toggle('visible');
    };

    // Show content when hotspot is clicked.
    wrapper.querySelector('.info-hotspot-header').addEventListener('click', toggle);

    // Hide content when close icon is clicked.
    modal.querySelector('.info-hotspot-close-wrapper').addEventListener('click', toggle);

    // Prevent touch and scroll events from reaching the parent element.
    // This prevents the view control logic from interfering with the hotspot.
    stopTouchAndScrollEventPropagation(wrapper);

    return wrapper;
  }

  // Prevent touch and scroll events from reaching the parent element.
  function stopTouchAndScrollEventPropagation(element, eventList) {
    var eventList = [ 'touchstart', 'touchmove', 'touchend', 'touchcancel',
                      'wheel', 'mousewheel' ];
    for (var i = 0; i < eventList.length; i++) {
      element.addEventListener(eventList[i], function(event) {
        event.stopPropagation();
      });
    }
  }

  function findSceneById(id) {
    for (var i = 0; i < scenes.length; i++) {
      if (scenes[i].data.id === id) {
        return scenes[i];
      }
    }
    return null;
  }

  function findSceneDataById(id) {
    for (var i = 0; i < data.scenes.length; i++) {
      if (data.scenes[i].id === id) {
        return data.scenes[i];
      }
    }
    return null;
  }

  // Welcome / splash screen.
  if (welcomeProjectNameElement) {
    welcomeProjectNameElement.innerHTML = sanitize(data.name || '');
  }
  if (welcomeEnterButtonElement && welcomeScreenElement) {
    welcomeEnterButtonElement.addEventListener('click', function() {
      welcomeScreenElement.classList.add('hidden');
    });
  }

  // ---------------------------------------------------------------------
  // VR / Cardboard mode: side-by-side stereo view controlled by the phone's
  // gyroscope (DeviceOrientation API). Marzipano has no built-in VR mode,
  // so this mirrors the current scene into a second viewer for the right
  // eye and drives the real view's yaw/pitch from device orientation.
  // ---------------------------------------------------------------------

  var vrActive = false;
  var vrRightViewer = null;
  var vrRightSceneEntry = null;
  var vrSyncRafId = null;
  var vrOrientationHandler = null;
  var vrOrientationCalibration = null;

  function enterVR() {
    if (vrActive || !currentSceneEntry) {
      return;
    }
    vrActive = true;

    stopAutorotate();
    document.body.classList.add('vr-mode');
    vrToggleElement.classList.add('enabled');

    // Move the live, interactive panorama into the left-eye pane.
    vrPanoLeftElement.appendChild(panoElement);

    // Build a lightweight mirror viewer for the right eye, showing the
    // same scene. It has no controls of its own; it just follows the
    // left eye's view parameters every frame.
    vrRightViewer = new Marzipano.Viewer(vrPanoRightElement, viewerOpts);
    vrRightSceneEntry = createSceneOnViewer(vrRightViewer, currentSceneEntry.data);
    vrRightSceneEntry.scene.switchTo();

    var syncRightEye = function() {
      if (!vrActive) {
        return;
      }
      if (vrRightSceneEntry && currentSceneEntry) {
        vrRightSceneEntry.view.setParameters(currentSceneEntry.view.parameters());
      }
      vrSyncRafId = window.requestAnimationFrame(syncRightEye);
    };
    syncRightEye();

    if (screenfull.enabled) {
      screenfull.request(vrScreenElement);
    }

    enableGyro();
  }

  function exitVR() {
    if (!vrActive) {
      return;
    }
    vrActive = false;

    disableGyro();

    if (vrSyncRafId) {
      window.cancelAnimationFrame(vrSyncRafId);
      vrSyncRafId = null;
    }

    if (vrRightViewer) {
      vrPanoRightElement.innerHTML = '';
      vrRightViewer = null;
      vrRightSceneEntry = null;
    }

    // Put the panorama back where it normally lives in the page.
    panoOriginalParent.insertBefore(panoElement, panoOriginalNextSibling);

    document.body.classList.remove('vr-mode');
    vrToggleElement.classList.remove('enabled');

    if (screenfull.enabled && screenfull.isFullscreen) {
      screenfull.exit();
    }

    startAutorotate();
  }

  // ---------------------------------------------------------------------
  // WebXR (Meta Quest and other headsets): true head-tracked stereo VR,
  // built from the original equirectangular panoramas. This is what
  // powers the VR button on Quest's browser, which supports the WebXR
  // Device API but — unlike a phone — does not fire DeviceOrientation
  // events, so the cardboard mode above can't track head movement there.
  //
  // Expects one equirectangular JPG per scene at:
  //   pano/<scene-id>.jpg   e.g. pano/0-recibidor.jpg
  // (the "id" values already used in data.js).
  //
  // three.js is only downloaded if the browser actually reports WebXR
  // support, so regular phone/desktop visitors never pay that cost.
  // ---------------------------------------------------------------------

  var xrSupported = false;
  var threeLoadPromise = null;
  var xrRenderer = null;
  var xrScene = null;
  var xrCamera = null;
  var xrSession = null;

  if (navigator.xr && navigator.xr.isSessionSupported) {
    navigator.xr.isSessionSupported('immersive-vr').then(function(supported) {
      xrSupported = supported;
      if (supported) {
        document.body.classList.add('xr-supported');
      }
    }).catch(function() {
      xrSupported = false;
    });
  }

  function loadThree() {
    if (threeLoadPromise) {
      return threeLoadPromise;
    }
    threeLoadPromise = new Promise(function(resolve, reject) {
      if (window.THREE) {
        resolve(window.THREE);
        return;
      }
      var script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js';
      script.onload = function() { resolve(window.THREE); };
      script.onerror = function() { reject(new Error('No se pudo cargar three.js')); };
      document.head.appendChild(script);
    });
    return threeLoadPromise;
  }

  function equirectUrlForScene(sceneData) {
    return 'pano/' + sceneData.id + '.jpg';
  }

  function enterXR() {
    if (!currentSceneEntry || xrSession) {
      return;
    }

    loadThree().then(function(THREE) {
      stopAutorotate();

      xrRenderer = new THREE.WebGLRenderer({ antialias: true });
      xrRenderer.setPixelRatio(window.devicePixelRatio);
      xrRenderer.setSize(window.innerWidth, window.innerHeight);
      xrRenderer.xr.enabled = true;
      xrRenderer.outputEncoding = THREE.sRGBEncoding;
      vrXRContainerElement.appendChild(xrRenderer.domElement);
      vrXRContainerElement.classList.add('active');

      xrScene = new THREE.Scene();
      xrCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);

      // Inverted sphere: the camera sits at the center looking outward
      // at the inside surface, which is where the equirectangular
      // panorama gets mapped.
      var geometry = new THREE.SphereGeometry(500, 60, 40);
      geometry.scale(-1, 1, 1);

      var texture = new THREE.TextureLoader().load(
        equirectUrlForScene(currentSceneEntry.data),
        undefined,
        undefined,
        function() {
          console.error('No se encontró la imagen equirectangular: ' +
            equirectUrlForScene(currentSceneEntry.data));
        }
      );
      texture.encoding = THREE.sRGBEncoding;

      var material = new THREE.MeshBasicMaterial({ map: texture });
      xrScene.add(new THREE.Mesh(geometry, material));

      xrRenderer.setAnimationLoop(function() {
        xrRenderer.render(xrScene, xrCamera);
      });

      window.addEventListener('resize', onXRResize);

      navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] })
        .then(function(session) {
          xrSession = session;
          xrRenderer.xr.setReferenceSpaceType('local');
          xrRenderer.xr.setSession(session);

          vrToggleElement.classList.add('enabled');
          document.body.classList.add('vr-mode');

          session.addEventListener('end', cleanupXR);
        })
        .catch(function(err) {
          console.error('No se pudo iniciar la sesión de VR:', err);
          cleanupXR();
        });
    }).catch(function(err) {
      console.error(err);
    });
  }

  function onXRResize() {
    if (!xrRenderer || !xrCamera) {
      return;
    }
    xrCamera.aspect = window.innerWidth / window.innerHeight;
    xrCamera.updateProjectionMatrix();
    xrRenderer.setSize(window.innerWidth, window.innerHeight);
  }

  function exitXR() {
    if (xrSession) {
      xrSession.end();
    } else {
      cleanupXR();
    }
  }

  function cleanupXR() {
    window.removeEventListener('resize', onXRResize);

    if (xrRenderer) {
      xrRenderer.setAnimationLoop(null);
      if (xrRenderer.domElement && xrRenderer.domElement.parentNode) {
        xrRenderer.domElement.parentNode.removeChild(xrRenderer.domElement);
      }
      xrRenderer.dispose();
    }
    xrRenderer = null;
    xrScene = null;
    xrCamera = null;
    xrSession = null;

    vrXRContainerElement.classList.remove('active');
    vrToggleElement.classList.remove('enabled');
    document.body.classList.remove('vr-mode');

    startAutorotate();
  }

  vrToggleElement.addEventListener('click', function() {
    // Real head-tracked VR when the browser supports it (Meta Quest and
    // other headsets); otherwise fall back to the cardboard split-screen.
    if (xrSupported) {
      if (xrSession) {
        exitXR();
      } else {
        enterXR();
      }
      return;
    }
    if (vrActive) {
      exitVR();
    } else {
      enterVR();
    }
  });

  vrExitButtonElement.addEventListener('click', exitVR);

  document.addEventListener('keydown', function(event) {
    if (vrActive && (event.key === 'Escape' || event.keyCode === 27)) {
      exitVR();
    }
  });

  if (screenfull.enabled) {
    screenfull.on('change', function() {
      if (vrActive && !screenfull.isFullscreen) {
        exitVR();
      }
    });
  }

  // --- Gyroscope control -------------------------------------------------

  function enableGyro() {
    if (typeof DeviceOrientationEvent === 'undefined') {
      // No device orientation support (e.g. desktop). The split-screen
      // view still works and can be looked around with mouse/touch drag.
      return;
    }

    var start = function() {
      vrOrientationCalibration = null;
      vrOrientationHandler = function(event) {
        if (event.alpha === null && event.beta === null && event.gamma === null) {
          return;
        }
        handleDeviceOrientation(event);
      };
      window.addEventListener('deviceorientation', vrOrientationHandler);
    };

    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      // iOS 13+ requires an explicit permission prompt from a user gesture,
      // which is why this call happens inside the VR button's click handler.
      DeviceOrientationEvent.requestPermission().then(function(state) {
        if (state === 'granted') {
          start();
        }
      }).catch(function() {
        // Permission denied/unsupported; split-screen still works via drag.
      });
    } else {
      start();
    }
  }

  function disableGyro() {
    if (vrOrientationHandler) {
      window.removeEventListener('deviceorientation', vrOrientationHandler);
      vrOrientationHandler = null;
    }
    vrOrientationCalibration = null;
  }

  function handleDeviceOrientation(event) {
    if (!currentSceneEntry) {
      return;
    }

    var direction = deviceOrientationToDirection(event);

    if (!vrOrientationCalibration) {
      // Calibrate so the current view stays put the instant the gyro turns
      // on; further head movement is then applied as a relative offset.
      // (If left/right ever feels inverted on a given device, flip the
      // sign on the yaw line below.)
      var params = currentSceneEntry.view.parameters();
      vrOrientationCalibration = {
        yaw: direction.yaw,
        pitch: direction.pitch,
        viewYaw: params.yaw,
        viewPitch: params.pitch
      };
      return;
    }

    currentSceneEntry.view.setParameters({
      yaw: vrOrientationCalibration.viewYaw + (direction.yaw - vrOrientationCalibration.yaw),
      pitch: vrOrientationCalibration.viewPitch + (direction.pitch - vrOrientationCalibration.pitch)
    });
  }

  // Converts a deviceorientation event into a { yaw, pitch } looking
  // direction, accounting for the current screen rotation. This follows
  // the standard W3C DeviceOrientation -> quaternion conversion used
  // across WebVR/cardboard implementations (equivalent to three.js'
  // DeviceOrientationControls), reimplemented here without a 3D library.
  function deviceOrientationToDirection(event) {
    var alpha = event.alpha ? toRad(event.alpha) : 0;
    var beta = event.beta ? toRad(event.beta) : 0;
    var gamma = event.gamma ? toRad(event.gamma) : 0;
    var orient = toRad(getScreenOrientationAngle());

    var q = quatFromEulerYXZ(beta, alpha, -gamma);
    q = quatMultiply(q, QUAT_WORLD_TO_SCREEN);
    q = quatMultiply(q, quatFromAxisAngleZ(-orient));

    // Forward vector (0, 0, -1) rotated by the orientation quaternion.
    var vx = -2 * (q.w * q.y + q.z * q.x);
    var vy =  2 * (q.w * q.x - q.z * q.y);
    var vz = -1 + 2 * (q.x * q.x + q.y * q.y);

    return {
      yaw: Math.atan2(vx, -vz),
      pitch: Math.asin(Math.max(-1, Math.min(1, vy)))
    };
  }

  function getScreenOrientationAngle() {
    if (window.screen && window.screen.orientation && typeof window.screen.orientation.angle === 'number') {
      return window.screen.orientation.angle;
    }
    return window.orientation || 0;
  }

  function toRad(deg) {
    return deg * Math.PI / 180;
  }

  // Minimal quaternion helpers (kept dependency-free on purpose).
  var QUAT_WORLD_TO_SCREEN = { x: -Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 };

  function quatMultiply(a, b) {
    return {
      x: a.w*b.x + a.x*b.w + a.y*b.z - a.z*b.y,
      y: a.w*b.y - a.x*b.z + a.y*b.w + a.z*b.x,
      z: a.w*b.z + a.x*b.y - a.y*b.x + a.z*b.w,
      w: a.w*b.w - a.x*b.x - a.y*b.y - a.z*b.z
    };
  }

  function quatFromEulerYXZ(x, y, z) {
    var c1 = Math.cos(x/2), c2 = Math.cos(y/2), c3 = Math.cos(z/2);
    var s1 = Math.sin(x/2), s2 = Math.sin(y/2), s3 = Math.sin(z/2);
    return {
      x: s1*c2*c3 + c1*s2*s3,
      y: c1*s2*c3 - s1*c2*s3,
      z: c1*c2*s3 - s1*s2*c3,
      w: c1*c2*c3 + s1*s2*s3
    };
  }

  function quatFromAxisAngleZ(angle) {
    return { x: 0, y: 0, z: Math.sin(angle/2), w: Math.cos(angle/2) };
  }

  // Display the initial scene.
  switchScene(scenes[0]);

})();
