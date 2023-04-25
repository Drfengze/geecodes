var geometry = ee.Geometry.Point([127.2505, 38.2013]).buffer(1000);
var startDate = '2020-03-01';
var endDate = '2020-09-30';

// 加载Sentinel-1数据集
var collection = ee.ImageCollection('COPERNICUS/S1_GRD')
          .filterDate(startDate, endDate)
          // .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
          .select('VV')
          // .filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING'))
          .filter(ee.Filter.eq('instrumentMode', 'IW'))
          .filterBounds(geometry);
print(collection)
// Visualization parameters.


var args = {
  'region': geometry,
  'dimensions': 600,
  'crs': 'EPSG:3857',
  'framesPerSecond': 5,
  'format': 'gif',
  // 'palette': ['08306B', '08519C', '2171B5', '4292C6', '6BAED6', '9ECAE1', 'C6DBEF', 'DEEBF7', 'F7FBFF']

};




//https://code.earthengine.google.com/347fefffbe3809f1285bd7c2132f9116  PROBAR CODIGO

var text = require('users/gena/packages:text'); // Import gena's package which allows text overlay on image

var annotations = [
  {position: 'right', offset: '80%', margin: '80%', property: 'label', scale: 10} //large scale because image if of the whole world. Use smaller scale otherwise
  ]
  
function addText(image){
  
  var timeStamp = ee.Date(image.get('system:time_start')).format().slice(0,10); // get the time stamp of each frame. This can be any string. Date, Years, Hours, etc.
  var timeStamp = ee.String('CRK Sentinel-1/VV Date: ').cat(ee.String(timeStamp)); //convert time stamp to string 
  var image = image.visualize({ //convert each frame to RGB image explicitly since it is a 1 band image
      // forceRgbOutput: true,
      min: -25,
      max: 5,
      palette: ['08306B', '08519C', '2171B5', '4292C6', '6BAED6', '9ECAE1', 'C6DBEF', 'DEEBF7', 'F7FBFF']
    }).set({'label':timeStamp}); // set a property called label for each image
  
  var annotated = text.annotateImage(image, {}, geometry, annotations); // create a new image with the label overlayed using gena's package

  return annotated 
}

var collection = collection.map(addText) //add time stamp to all images
print(collection)  
print(collection.getVideoThumbURL(args));

print(ui.Thumbnail(collection,args));
