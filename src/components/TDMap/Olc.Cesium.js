/* eslint-disable */
import Cesium from 'cesium/Cesium';
import CesiumNavigation from 'cesium-navigation-es6';
import NcDataProcess from './ncProcess'
import ParticleSystem from './particleSystem';
import Util from './util';


let cesiumMap = new Object();


let viewer;
cesiumMap.map = function() {
};

cesiumMap.map.prototype = {
  initMap: function(element) {
    this.startUp(Cesium, element);
  },
  startUp: function(Cesium, element) {
    'use strict';
    Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI4ZmVjNGI2Zi1kMTA3LTQ4NjEtOWY5Mi1hOTQ0NjkwYzM0Y2YiLCJpZCI6NjQyMiwic2NvcGVzIjpbImFzciIsImdjIl0sImlhdCI6MTU0NjQ4MjQzMH0.TmEcQVmerVoMPXZ2_xa9D2Dy5Wysy2j6_tgPeiV88aM';
    viewer = new Cesium.Viewer(element, {
      baseLayerPicker: false,
      geocoder: true,
      homeButton: false,
      sceneModePicker: false,
      fullscreenButton: false,
      vrButton: false,
      animation: false,
      timeline: false,
      infoBox: false,
      selectionIndicator: false,
      requestRenderMode: true,
      navigationHelpButton: false,
      navigationInstructionsInitiallyVisible: false,
    });
    viewer.scene.globe.depthTestAgainstTerrain = true;
  },
  setView: function(x, y, h) {
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(x, y, h),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-90),
        roll: Cesium.Math.toRadians(0),
      },
    });
  },
};

cesiumMap.windField = function(panel,mode) {
  const options = {
    baseLayerPicker: false,
    geocoder: false,
    infoBox: false,
    fullscreenElement: 'cesiumContainer',
    scene3DOnly: true,
  };

  if (mode.debug) {
    options.useDefaultRenderLoop = false;
  }

  this.viewer = viewer;
  this.scene = viewer.scene;
  this.camera = viewer.camera;

  this.panel = panel;

  this.viewerParameters = {
    lonRange: new Cesium.Cartesian2(),
    latRange: new Cesium.Cartesian2(),
    pixelSize: 0.0
  };
  // use a smaller earth radius to make sure distance to camera > 0
  this.globeBoundingSphere = new Cesium.BoundingSphere(Cesium.Cartesian3.ZERO, 0.99 * 6378137.0);
  this.updateViewerParameters();

  NcDataProcess.loadData().then(
    (data) => {
      this.particleSystem = new ParticleSystem(this.scene.context, data,
        this.panel.getUserInput(), this.viewerParameters);
      this.addPrimitives();

      this.setupEventListeners();

      if (mode.debug) {
        this.debug();
      }
    });

  this.imageryLayers = this.viewer.imageryLayers;
  this.setGlobeLayer(this.panel.getUserInput());
};
cesiumMap.windField.prototype = {
  //路线动画
  addPrimitives: function() {
    // the order of primitives.add() should respect the dependency of primitives
    this.scene.primitives.add(this.particleSystem.particlesComputing.primitives.getWind);
    this.scene.primitives.add(this.particleSystem.particlesComputing.primitives.updateSpeed);
    this.scene.primitives.add(this.particleSystem.particlesComputing.primitives.updatePosition);
    this.scene.primitives.add(this.particleSystem.particlesComputing.primitives.postProcessingPosition);
    this.scene.primitives.add(this.particleSystem.particlesComputing.primitives.postProcessingSpeed);

    this.scene.primitives.add(this.particleSystem.particlesRendering.primitives.segments);
    this.scene.primitives.add(this.particleSystem.particlesRendering.primitives.trails);
    this.scene.primitives.add(this.particleSystem.particlesRendering.primitives.screen);
  },

  updateViewerParameters:function() {
    var viewRectangle = this.camera.computeViewRectangle(this.scene.globe.ellipsoid);
    var lonLatRange = Util.viewRectangleToLonLatRange(viewRectangle);
    this.viewerParameters.lonRange.x = lonLatRange.lon.min;
    this.viewerParameters.lonRange.y = lonLatRange.lon.max;
    this.viewerParameters.latRange.x = lonLatRange.lat.min;
    this.viewerParameters.latRange.y = lonLatRange.lat.max;

    var pixelSize = this.camera.getPixelSize(
      this.globeBoundingSphere,
      this.scene.drawingBufferWidth,
      this.scene.drawingBufferHeight
    );

    if (pixelSize > 0) {
      this.viewerParameters.pixelSize = pixelSize;
    }
  },

  setGlobeLayer(userInput) {
    this.viewer.imageryLayers.removeAll();
    this.viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();

    var globeLayer = userInput.globeLayer;
    switch (globeLayer.type) {
      case "NaturalEarthII": {
        this.viewer.imageryLayers.addImageryProvider(
          Cesium.createTileMapServiceImageryProvider({
            url: Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')
          })
        );
        break;
      }
      case "WMS": {
        this.viewer.imageryLayers.addImageryProvider(new Cesium.WebMapServiceImageryProvider({
          url: userInput.WMS_URL,
          layers: globeLayer.layer,
          parameters: {
            ColorScaleRange: globeLayer.ColorScaleRange
          }
        }));
        break;
      }
      case "WorldTerrain": {
        this.viewer.imageryLayers.addImageryProvider(
          Cesium.createWorldImagery()
        );
        this.viewer.terrainProvider = Cesium.createWorldTerrain();
        break;
      }
    }
  },

  setupEventListeners() {
    const that = this;

    this.camera.moveStart.addEventListener(function () {
      that.scene.primitives.show = false;
    });

    this.camera.moveEnd.addEventListener(function () {
      that.updateViewerParameters();
      that.particleSystem.applyViewerParameters(that.viewerParameters);
      that.scene.primitives.show = true;
    });

    var resized = false;
    window.addEventListener("resize", function () {
      resized = true;
      that.scene.primitives.show = false;
      that.scene.primitives.removeAll();
    });

    this.scene.preRender.addEventListener(function () {
      if (resized) {
        that.particleSystem.canvasResize(that.scene.context);
        resized = false;
        that.addPrimitives();
        that.scene.primitives.show = true;
      }
    });

    window.addEventListener('particleSystemOptionsChanged', function () {
      that.particleSystem.applyUserInput(that.panel.getUserInput());
    });
    window.addEventListener('layerOptionsChanged', function () {
      that.setGlobeLayer(that.panel.getUserInput());
    });
  },

  debug() {
    const that = this;

    var animate = function () {
      that.viewer.resize();
      that.viewer.render();
      requestAnimationFrame(animate);
    }

    var spector = new SPECTOR.Spector();
    spector.displayUI();
    spector.spyCanvases();

    animate();
  }

};


cesiumMap.control = function() {
};

cesiumMap.control.prototype = {
  initNavigation: function() {
    let options = {};
    options.defaultResetView = Cesium.Rectangle.fromDegrees(80, 22, 130, 50);
    options.enableCompass = true;
    options.enableZoomControls = true;
    options.enableDistanceLegend = true;
    options.enableCompassOuterRing = true;
    CesiumNavigation(viewer, options);
  },

  mousePosition: function(node) {
    let canvas = viewer.scene.canvas;
    let ellipsoid = viewer.scene.globe.ellipsoid;
    let handler = new Cesium.ScreenSpaceEventHandler(canvas);
    handler.setInputAction(function(movement) {
      let cartesian = viewer.camera.pickEllipsoid(movement.endPosition, ellipsoid);
      if (cartesian) {
        let cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(cartesian);
        let lat_String = Cesium.Math.toDegrees(cartographic.latitude).toFixed(4);
        let log_String = Cesium.Math.toDegrees(cartographic.longitude).toFixed(4);
        let alti_String = (viewer.camera.positionCartographic.height / 1000).toFixed(2);
        node.innerHTML = `${log_String}, ${lat_String}`;
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  },

};


export default cesiumMap;
