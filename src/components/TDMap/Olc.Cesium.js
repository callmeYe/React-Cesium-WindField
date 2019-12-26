/* eslint-disable */
import Cesium from 'cesium/Cesium';
import CesiumNavigation from 'cesium-navigation-es6';
import NcDataProcess from './ncProcess'
import ParticleSystem from './particleSystem';
import Util from './util';


let cesiumMap = new Object();

/**
 * Created by on 2019/3/6.
 */
/*******************************************************
 *  地图(图层)管理类
 *********************************************************/
let viewer;
cesiumMap.map = function() {
};

cesiumMap.map.prototype = {
  //初始化地图
  initMap: function(element) {
    this.startUp(Cesium, element);
  },
  //开始启动方法
  startUp: function(Cesium, element) {
    'use strict';
    Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI4ZmVjNGI2Zi1kMTA3LTQ4NjEtOWY5Mi1hOTQ0NjkwYzM0Y2YiLCJpZCI6NjQyMiwic2NvcGVzIjpbImFzciIsImdjIl0sImlhdCI6MTU0NjQ4MjQzMH0.TmEcQVmerVoMPXZ2_xa9D2Dy5Wysy2j6_tgPeiV88aM';
    viewer = new Cesium.Viewer(element, {
      baseLayerPicker: false, //是否显示图层选择控件
      geocoder: true,   //地名查找
      homeButton: false,
      sceneModePicker: false,  //投影方式空间
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
  //设置镜头位置与方向
  setView: function(x, y, h) {
    viewer.camera.setView({//镜头的经纬度、高度。镜头默认情况下，在指定经纬高度俯视（pitch=-90）地球
      destination: Cesium.Cartesian3.fromDegrees(x, y, h),//北京150000公里上空
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

/**
 * Created by zhangkailun on 2019/3/6.
 */
/*******************************************************
 *  控件类
 *********************************************************/
cesiumMap.control = function() {
};

cesiumMap.control.prototype = {
  initNavigation: function() {
    let options = {};
    // 用于在使用重置导航重置地图视图时设置默认视图控制。接受的值是Cesium.Cartographic 和 Cesium.Rectangle.
    options.defaultResetView = Cesium.Rectangle.fromDegrees(80, 22, 130, 50);
    // 用于启用或禁用罗盘。true是启用罗盘，false是禁用罗盘。默认值为true。如果将选项设置为false，则罗盘将不会添加到地图中。
    options.enableCompass = true;
    // 用于启用或禁用缩放控件。true是启用，false是禁用。默认值为true。如果将选项设置为false，则缩放控件将不会添加到地图中。
    options.enableZoomControls = true;
    // 用于启用或禁用距离图例。true是启用，false是禁用。默认值为true。如果将选项设置为false，距离图例将不会添加到地图中。
    options.enableDistanceLegend = true;
    // 用于启用或禁用指南针外环。true是启用，false是禁用。默认值为true。如果将选项设置为false，则该环将可见但无效。
    options.enableCompassOuterRing = true;
    CesiumNavigation(viewer, options);
  },

  //鼠标当前位置
  mousePosition: function(node) {
    let canvas = viewer.scene.canvas;
    let ellipsoid = viewer.scene.globe.ellipsoid;
    let handler = new Cesium.ScreenSpaceEventHandler(canvas);
    handler.setInputAction(function(movement) {
      //捕获椭球体，将笛卡尔二维平面坐标转为椭球体的笛卡尔三维坐标，返回球体表面的点
      let cartesian = viewer.camera.pickEllipsoid(movement.endPosition, ellipsoid);
      if (cartesian) {
        //将笛卡尔三维坐标转为地图坐标（弧度）
        let cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(cartesian);
        //将地图坐标（弧度）转为十进制的度数
        let lat_String = Cesium.Math.toDegrees(cartographic.latitude).toFixed(4);
        let log_String = Cesium.Math.toDegrees(cartographic.longitude).toFixed(4);
        let alti_String = (viewer.camera.positionCartographic.height / 1000).toFixed(2);
        node.innerHTML = `${log_String}, ${lat_String}`;
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  },

  //将矩阵转换为角度
  getmatrix: function() {
    var regex1 = '\\((.+?)\\)';
    var str = $('.ol_cesium3d_zhinan button:eq(1)').css('transform');
    var arr = str.match(regex1)[1].split(',');
    a = parseFloat(arr[0]);
    b = parseFloat(arr[1]);
    c = parseFloat(arr[2]);
    d = parseFloat(arr[3]);
    e = parseFloat(arr[4]);
    f = parseFloat(arr[5]);

    var aa = Math.round(180 * Math.asin(a) / Math.PI);
    var bb = Math.round(180 * Math.acos(b) / Math.PI);
    var cc = Math.round(180 * Math.asin(c) / Math.PI);
    var dd = Math.round(180 * Math.acos(d) / Math.PI);
    var deg = 0;
    if (aa == bb || -aa == bb) {
      deg = dd;
    } else if (-aa + bb == 180) {
      deg = 180 + cc;
    } else if (aa + bb == 180) {
      deg = 360 - cc || 360 - dd;
    }
    return deg >= 360 ? 0 : deg;
  },

  switchSceneMode: function(mode, node) {
    let scene = viewer.scene;
    switch (mode) {
      case '2D':
        scene.morphTo2D(0);
        node.innerText = '3D';
        break;
      case '3D':
        scene.morphTo3D(0);
        node.innerText = '2D';
        break;
      default:
        break;
    }
  },

  //初始化测量结果控件
  // leftorright 位于左或者右  num 是百分比
  // toporbottom 位于上或者下  num1 是百分比
  initMeasuretool: function(position, element) {
    //初始化绘制工具栏
    var measuretool = ' <div class="ol_cesium_3d_tool" style=" ' + position + '">'
      + '   <div class="ol_cesium_toolList"><a href="javascript:void(0)">'
      + '   <img src="../../assets/images/olImg/measure.png">测算</a>'
      + '    <div class="toolListwrap" style="width: 67px;">'
      + '   <div class="wraptriangle"></div>'
      + '    <ul id="ol_cesium_cesuan"> <li id="distanceButton"><img src="../../assets/images/olImg/distance.png">&nbsp;距离</li>'
      + '  <li id="areaButton"> <img src="../../assets/images/olImg/face.png">&nbsp;面积</li>'
      + '  <li id="clearAll"> <img src="">&nbsp;清除</li></ul></div> </div>'
      + ' <div class="ol_cesium_toolList">'
      + '    <a href="javascript:void(0)">'
      + '    <img src="../../assets/images/olImg/draw.png">绘制</a>  <div class="toolListwrap" style="width: 67px;">'
      + '    <div class="wraptriangle"></div> <ul id="ol_cesium3d_draws">'
      + '     <li id="Point"> <img src="../../assets/images/olImg/point.png">&nbsp;点</li>'
      + '  <li id="LineString"> <img src="../../assets/images/olImg/line.png">&nbsp;线</li>'
      + '  <li id="Polygon"> <img src="../../assets/images/olImg/area.png">&nbsp;面</li>'
      + ' <li id="Circle"><img src="../../assets/images/olImg/circular.png">&nbsp;圆</li>'
      + '  <li id="Box"><img src="../../assets/images/olImg/rectangle.png">&nbsp;矩形</li>'
      + '  <li id="clearAll"> <img src="">&nbsp;清除</li></ul>'
      + ' </div></div>'
      + '  <div class="ol_cesium_toolList clickActive">'
      + '     <a href="javascript:void(0)" id="ol_cesium_3d-button">  <img src="../../assets/images/olImg/satellite.png">2D</a></div>'
      + '  <div class="ol_cesium_toolList">'
      + '     <a href="javascript:void(0)" id="ol_cesium_3dvr-button"><img src="../../assets/images/olImg/vrl.png">全景</a></div>'
      + ' <div class="ol_cesium_toolList">'
      + '   <a href="javascript:void(0)">  <img src="../../assets/images/olImg/fullscreen.png">全屏</a></div></div>';
    $('#' + element).append(measuretool);
    //工具栏下拉
    $('.ol_cesium_toolList').hover(function() {
      $(this).find('.toolListwrap').css('display', 'block');
      $('#ol_cesium_3ddistancepan').css('display', 'none');
    }, function() {
      $(this).find('.toolListwrap').css('display', 'none');
    });
    var _this = this;
    //工具操作，画点、线、面、矩形、圆
    $('#ol_cesium3d_draws').on('click', 'li',
      function() {
        _this.clear3d_measureTool();
        $('#ol_cesium_3ddistancepan').css('display', 'none');
        var value = $(this).attr('id');
        if (value != 'clearAll') {
          if (value != 'None') {
            if (value == 'LineString') {
              var d_Draw = new cesiumMap.draw('#ff2500', 3, '3d_LineString', 1);
              d_Draw.drawLine();
            } else if (value == 'Point') {
              var d_Draw = new cesiumMap.draw('#ff2500', 3, '3d_Point', 1);
              d_Draw.drawPoint();

            } else if (value == 'Polygon') {
              var d_Draw = new cesiumMap.draw('#ff2500', 3, '3d_Polygon', 0.3);
              d_Draw.drawPolygon();

            } else if (value == 'Box') {
              var d_Draw = new cesiumMap.draw('#ff2500', 3, '3d_Box', 0.3);
              d_Draw.drawRectangle();
            } else if (value == 'Circle') {
              var d_Draw = new cesiumMap.draw('#ff2500', 3, '3d_Circle', 0.3);
              d_Draw.drawCircle();
            }

          }
        } else {
          _this.clear3d_drawTool();
        }
      });

    //绑定按钮测算事件
    $('#ol_cesium_cesuan').on('click', 'li',
      function() {
        _this.clear3d_drawTool();
        var value = $(this).attr('id');
        if (value == 'distanceButton') {
          //绘制结束事件  drawdistinces
          $('#cesium_distance3d').empty();
          var htmlStr = '';
          htmlStr = '距离：';
          $('#cesium_distance3d').append(htmlStr);
          var d_Draw = new cesiumMap.draw('#ff2500', 3, '3d_Line_measure', 1);
          var drawdistinces = d_Draw.measureDistance();
          $('#ol_cesium_3ddistancepan').css('display', 'block');

        } else if (value == 'areaButton') {
          $('#cesium_distance3d').empty();
          var htmlStr = '';
          htmlStr = '面积：';
          $('#cesium_distance3d').append(htmlStr);
          var d_Draw = new cesiumMap.draw('#ff2500', 3, '3d_polygon_measure', 0.3);
          var drawdistinces = d_Draw.measureArea();
          $('#ol_cesium_3ddistancepan').css('display', 'block');
        } else if (value == 'clearAll') {
          $('#ol_cesium_3ddistancepan').css('display', 'none');
          //ClearDraw();
          _this.clear3d_measureTool();
        }
      });


  },
  //清除绘线，面，矩形，圆
  clear3d_drawTool: function() {
    var d_Draw = new cesiumMap.draw();
    d_Draw.clearById('3d_LineString');
    d_Draw.clearById('3d_Point');
    d_Draw.clearById('3d_Polygon');
    d_Draw.clearById('3d_Box');
    d_Draw.clearById('3d_Circle');
  },
  //清除量算
  clear3d_measureTool: function() {
    var d_Draw = new cesiumMap.draw();
    d_Draw.clearById('3d_Line_measure');
    d_Draw.clearById('3d_polygon_measure');
  },
  //初始化结果面板的HTML
  initDistancehtml: function(position, element) {
    /*距离结果面板*/
    var distance = '<div id="ol_cesium_3ddistancepan" class="ol_cesium_distancepan" style=" ' + position + '">'
      + '   <div id="cesium_distance3d" style="margin-top: 9px;margin-left: 8px;" title="距离量算结果面板"></div></div> ';
    $('#' + element).append(distance);
  },
};


export default cesiumMap;
