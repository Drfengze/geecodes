var GRAYMAP = [
    {   // Dial down the map saturation.
        stylers: [{ saturation: -100 }]
    }, { // Dial down the label darkness.
        elementType: 'labels',
        stylers: [{ lightness: 20 }]
    }, { // Simplify the road geometries.
        featureType: 'road',
        elementType: 'geometry',
        stylers: [{ visibility: 'simplified' }]
    }, { // Turn off road labels.
        featureType: 'road',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }]
    }, { // Turn off all icons.
        elementType: 'labels.icon',
        stylers: [{ visibility: 'off' }]
    }, { // Turn off all POIs.
        featureType: 'poi',
        elementType: 'all',
        stylers: [{ visibility: 'off' }]
    }
];

Map.setOptions('Gray', { 'Gray': GRAYMAP });

var us = ee.FeatureCollection(
    "FAO/GAUL_SIMPLIFIED_500m/2015/level1").filter('ADM0_NAME == "United States of America"');
var states = ["Washington"];
var trainingPolys = us.filter(ee.Filter.inList("ADM1_NAME", states));
var geometry = trainingPolys;


function maskL8sr(image) {
    var cloudShadowBitMask = ee.Number(2).pow(4).int()
    var cloudsBitMask = ee.Number(2).pow(3).int()
    var qa = image.select('QA_PIXEL')
    var mask1 = qa.bitwiseAnd(cloudShadowBitMask).eq(0).and(
        qa.bitwiseAnd(cloudsBitMask).eq(0))
    var mask2 = image.mask().reduce('min')

    var mask = mask1.and(mask2)
    return image.updateMask(mask).copyProperties(image, ["system:time_start"])
}

var EPOCH = ee.Date('1979-01-01')
var addDate = function (image) {
    var mask = image.mask().reduce(ee.Reducer.min())
    var days = image.date().difference(EPOCH, 'day')
    return ee.Image.constant(days).int()
        .clip(image.geometry())
        .updateMask(mask)
        .copyProperties(image, ["system:time_start"])
}

var year_start = 2015
var year_end = 2018
var month_start = 4
var month_end = 6
var start = '2022-06-20'
var end = '2022-08-19'
var imgCol = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
    .filterBounds(geometry)
    .filterDate(start, end)
    .map(maskL8sr)
    .map(addDate)
var l8 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2");
var s2Sr = ee.ImageCollection('COPERNICUS/S2_SR');
var s2Clouds = ee.ImageCollection('COPERNICUS/S2_CLOUD_PROBABILITY');

var MAX_CLOUD_PROBABILITY = 65;


function maskClouds(img) {
    var clouds = ee.Image(img.get('cloud_mask')).select('probability');
    var isNotCloud = clouds.lt(MAX_CLOUD_PROBABILITY);
    return img.updateMask(isNotCloud);
}

// The masks for the 10m bands sometimes do not exclude bad data at
// scene edges, so we apply masks from the 20m and 60m bands as well.
// Example asset that needs this operation:
// COPERNICUS/S2_CLOUD_PROBABILITY/20190301T000239_20190301T000238_T55GDP
function maskEdges(s2_img) {
    return s2_img.updateMask(
        s2_img.select('B8A').mask().updateMask(s2_img.select('B9').mask()));
}

// Filter input collections by desired data range and region.
var criteria = ee.Filter.and(
    ee.Filter.bounds(geometry), ee.Filter.date(start, end));
s2Sr = s2Sr.filter(criteria).map(maskEdges);
s2Clouds = s2Clouds.filter(criteria);

// Join S2 SR with cloud probability dataset to add cloud mask.
var s2SrWithCloudMask = ee.Join.saveFirst('cloud_mask').apply({
    primary: s2Sr,
    secondary: s2Clouds,
    condition:
        ee.Filter.equals({ leftField: 'system:index', rightField: 'system:index' })
});

var s2 =
    ee.ImageCollection(s2SrWithCloudMask).map(maskClouds);

var bandNamesOut = ['blue', 'green', 'red', 'nir', 'swir1', 'swir2'];
var bandNamesl8 = ['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7'];
var bandNamesS2 = ['B2', 'B3', 'B4', 'B8', 'B11', 'B12'];


// Add NDVI band to image collection
var l8 = l8.map(maskL8sr);
l8 = l8.filterBounds(geometry).select(bandNamesl8, bandNamesOut).filterDate(start, end);
print(l8);
l8 = l8.map(addDate).reduce(ee.Reducer.countDistinct())
s2 = s2.map(addDate).reduce(ee.Reducer.countDistinct());

var palette = ["#efedf5", "orange"];
// var palette = ["yellow", "red"]
var vis = { min: 0, max: 10, palette: palette };

var nSteps = 10
// Creates a color bar thumbnail image for use in legend from the given color palette
function makeColorBarParams(palette) {
    return {
        bbox: [0, 0, nSteps, 0.1],
        dimensions: '100x10',
        format: 'png',
        min: 0,
        max: nSteps,
        palette: palette,
    };
}

// Create the colour bar for the legend
var colorBar = ui.Thumbnail({
    image: ee.Image.pixelLonLat().select(0).int(),
    params: makeColorBarParams(vis.palette),
    style: { stretch: 'horizontal', margin: '0px 8px', maxHeight: '24px' },
});

// Create a panel with three numbers for the legend
var legendLabels = ui.Panel({
    widgets: [
        ui.Label(vis.min, { margin: '4px 8px' }),
        ui.Label(
            ((vis.max - vis.min) / 2 + vis.min),
            { margin: '4px 8px', textAlign: 'center', stretch: 'horizontal' }),
        ui.Label(vis.max, { margin: '4px 8px' })
    ],
    layout: ui.Panel.Layout.flow('horizontal')
});

// Legend title
var legendTitle = ui.Label({
    value: 'Valid Obs\n' + 'From:' + start + 'To:' + end,
    style: { fontWeight: 'bold' }
});

// Add the legendPanel to the map
var legendPanel = ui.Panel([legendTitle, colorBar, legendLabels]);
Map.add(legendPanel);
var image = ee.ImageCollection([s2, l8]).sum()
// Map.addLayer(image,vis,'Valid Obs')

var hist = ui.Chart.image.histogram(
    {
        image: image,
        region: geometry,
        scale: 30,
        maxPixels: 1e15
    }
)
print(hist)
// print(image)
// // COUNT EACH PIXEL VALUE FREQUENCY (ZONAL STATS)
// var Hist_featureCollection = ee.FeatureCollection(trainingPolys.map(function(geometry){
//   var stats = image.clip(geometry).reduceRegion({
//   reducer: ee.Reducer.frequencyHistogram(),
//   scale: 30,
//   maxPixels: 1e15});
//   //var image_Stats = image.set('pixelCount', stats)
//   var featurestats = ee.Feature(null, {'pixelCount': stats});
//   //var FeatStats = ee.FeatureCollection([featurestats]);
//   return featurestats; // if i return FeatStats and export, the data table is empty
// }));

// print(Hist_featureCollection);

// // Get a list of the dates.
// Export.table.toDrive({
//   collection: Hist_featureCollection,
//   folder: 'GEE',
//   description:'pixelHist',
//   selectors: ['system:index','DATE_ACQUIRED', 'pixelCount'],
//   fileFormat: 'CSV'
// });
