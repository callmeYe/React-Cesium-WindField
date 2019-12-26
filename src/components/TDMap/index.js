import styles from './index.less';
import React, { Component } from 'react';
import CesiumMap from './Olc.Cesium.js';
import {Panel} from './gui';
import 'cesium/Widgets/widgets.css';

class TDMap extends Component {
  constructor(props) {
    super(props);
  }

  componentDidMount() {
    let cesium_Map = new CesiumMap.map();
    let cesium_Control = new CesiumMap.control();
    this.setState({ cesium_Map: cesium_Map });
    // // 初始化地球
    cesium_Map.initMap('cesiumContainer');
    cesium_Map.setView(116.3, 39.9, 15000000);
    cesium_Control.initNavigation();
    cesium_Control.mousePosition(document.getElementById('currentPosition'));

    const mode ={
      debug:false
    };
    var panel = new Panel();
    var wind3D = new CesiumMap.windField(panel,mode);
  }

  render() {
    function sceneSwitch() {
      let cesium_control = new CesiumMap.control();
      let node = document.getElementById('sceneSwitcher');
      let mode = node.innerText;
      cesium_control.switchSceneMode(mode, node);
    }

    return (
      <div className={styles.normal}>
        <div id="cesiumContainer" className={styles.fullScreen_3d}>
          <div className={styles.dimensionSwitcher}>
            <button id="sceneSwitcher" onClick={sceneSwitch}>2D</button>
          </div>
        </div>
        <div id="currentPosition"/>
      </div>);
  }
}

export default TDMap;
