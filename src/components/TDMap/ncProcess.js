import Util from './util';
import {fileOptions} from './gui';
import demoNC from '@/assets/demo.nc';
import Cesium from 'cesium/Cesium';
const NetCDFReader = require('netcdfjs');

var NcDataProcess = (function () {
    var data;

    var loadNetCDF = function (filePath) {
        return new Promise(function (resolve) {
            var request = new XMLHttpRequest();
            request.open('GET', demoNC);
            request.responseType = 'arraybuffer';

            request.onload = function () {
                var arrayToMap = function (array) {
                    return array.reduce(function (map, object) {
                        map[object.name] = object;
                        return map;
                    }, {});
                }

                var NetCDF = new NetCDFReader(request.response);
                data = {};

                var dimensions = arrayToMap(NetCDF.dimensions);
                data.dimensions = {};
                data.dimensions.lon = dimensions['lon'].size;
                data.dimensions.lat = dimensions['lat'].size;
                data.dimensions.lev = dimensions['lev'].size;

                var variables = arrayToMap(NetCDF.variables);
                var uAttributes = arrayToMap(variables['U'].attributes);
                var vAttributes = arrayToMap(variables['V'].attributes);

                data.lon = {};
                data.lon.array = new Float32Array(NetCDF.getDataVariable('lon').flat());
                data.lon.min = Math.min(...data.lon.array);
                data.lon.max = Math.max(...data.lon.array);

                data.lat = {};
                data.lat.array = new Float32Array(NetCDF.getDataVariable('lat').flat());
                data.lat.min = Math.min(...data.lat.array);
                data.lat.max = Math.max(...data.lat.array);

                data.lev = {};
                data.lev.array = new Float32Array(NetCDF.getDataVariable('lev').flat());
                data.lev.min = Math.min(...data.lev.array);
                data.lev.max = Math.max(...data.lev.array);

                data.U = {};
                data.U.array = new Float32Array(NetCDF.getDataVariable('U').flat());
                data.U.min = uAttributes['min'].value;
                data.U.max = uAttributes['max'].value;

                data.V = {};
                data.V.array = new Float32Array(NetCDF.getDataVariable('V').flat());
                data.V.min = vAttributes['min'].value;
                data.V.max = vAttributes['max'].value;

                resolve(data);
            };

            request.send();
        });
    }

    var loadColorTable = function (filePath) {
        var string = Util.loadText(filePath);
        var json = JSON.parse(string);

        var colorNum = json['ncolors'];
        var colorTable = json['colorTable'];

        var colorsArray = new Float32Array(3 * colorNum);
        for (var i = 0; i < colorNum; i++) {
            colorsArray[3 * i] = colorTable[3 * i];
            colorsArray[3 * i + 1] = colorTable[3 * i + 1];
            colorsArray[3 * i + 2] = colorTable[3 * i + 2];
        }

        data.colorTable = {};
        data.colorTable.colorNum = colorNum;
        data.colorTable.array = colorsArray;
    }

    var loadData = async function () {
        console.log(fileOptions);
        var ncFilePath = fileOptions.dataDirectory + fileOptions.dataFile;
        await loadNetCDF(ncFilePath);

        var colorTableFilePath = fileOptions.dataDirectory + 'colorTable.json';
        loadColorTable(colorTableFilePath);

        return data;
    }

    var randomizeParticles = function (maxParticles, viewerParameters) {
        var array = new Float32Array(4 * maxParticles);
        for (var i = 0; i < maxParticles; i++) {
            array[4 * i] = Cesium.Math.randomBetween(viewerParameters.lonRange.x, viewerParameters.lonRange.y);
            array[4 * i + 1] = Cesium.Math.randomBetween(viewerParameters.latRange.x, viewerParameters.latRange.y);
            array[4 * i + 2] = Cesium.Math.randomBetween(data.lev.min, data.lev.max);
            array[4 * i + 3] = 0.0;
        }
        return array;
    }

    return {
        loadData: loadData,
        randomizeParticles: randomizeParticles
    };

})();

export default NcDataProcess;
