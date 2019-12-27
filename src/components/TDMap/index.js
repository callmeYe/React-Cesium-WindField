import styles from './index.less';
import React, { Component } from 'react';
import CesiumMap from './Olc.Cesium.js';
import {Panel} from './gui';
import 'cesium/Widgets/widgets.css';

class TDMap extends Component {

  componentDidMount() {
    let cesium_Map = new CesiumMap.map();
    let cesium_Control = new CesiumMap.control();
    this.setState({ cesium_Map: cesium_Map });

    cesium_Map.initMap('cesiumContainer');
    cesium_Map.setView(116.3, 39.9, 15000000);
    cesium_Control.initNavigation();
    cesium_Control.mousePosition(document.getElementById('currentPosition'));

    const mode ={
      debug:false
    };
    const panel = new Panel();
    new CesiumMap.windField(panel,mode);
  }

  render() {
    return (
      <div className={styles.normal}>
        <div id="cesiumContainer" className={styles.fullScreen_3d}>
        </div>
        <div id="currentPosition"/>
      </div>);
  }
}

export default TDMap;
