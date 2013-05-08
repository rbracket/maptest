// Start here
var apiKey = "Ao5Ew1XnxVey8Mh0jgfL32mbQN1pNLQoDv48u1r5BJrGsf8r0Bach7FYO5wTpbHl";  // My Bing API key. Please get your own at http://bingmapsportal.com/ and use that instead.

var buttonsHeight;
var i_mapArea;

var map;
var i_map;

var wgs = new OpenLayers.Projection("EPSG:4326");
var sm = new OpenLayers.Projection("EPSG:900913");
var geoJSONparser = new OpenLayers.Format.GeoJSON({ignoreExtraDims: true});

var intersectionStyleMap = new OpenLayers.StyleMap({pointRadius: 7}); 
var intersectionLookup = {"y": {fillColor: "orange", graphicName: "triangle"},"n": {fillColor: "blue"}};
intersectionStyleMap.addUniqueValueRules("default", "evaluated", intersectionLookup); //evaluated is attribute of intersections

var rampStyleMap = new OpenLayers.StyleMap({display: "none"});

var hiLiteStyleMap = new OpenLayers.StyleMap({strokeWidth: 12});
var hiLiteLookup = {0: {display: "none"}, 1: {strokeColor: "cyan"}};
hiLiteStyleMap.addUniqueValueRules("default", "activeOne", hiLiteLookup); //active is attribute of hiLite

var stateStyleMap = new OpenLayers.StyleMap({strokeWidth: 6, strokeColor: "white"});
var stateLookup = {"none": {strokeColor: "white"}, "yes": {strokeColor: "green"}, "sort_of": {strokeColor: "yellow"}, "no": {strokeColor: "red"}};
stateStyleMap.addUniqueValueRules("default", "state", stateLookup); //state is attribute of rampAttrs

var areaMapStrategy;
var detailMapStrategy;
var hiLiteMapStrategy;
var detailProtocol;

var intersectionID; 
var currentRamp;
var hiLite;
var rampAttrs;

function setSize() {
	buttonsHeight = jQuery("div[id='buttons']:visible").height();
	if (buttonsHeight){
		i_mapArea = jQuery("div[id='i_map']:visible");
		if (i_mapArea.height() + buttonsHeight !== jQuery(window).height()) {
			i_mapArea.height(jQuery(window).height() - buttonsHeight);
		};
	}
    if (window.map && window.map instanceof OpenLayers.Map) {map.updateSize();};
}

/* initialize area map page */
function initAreaMap() {
	areaMapStrategy = new OpenLayers.Strategy.Refresh({interval: 60000, force: true})
    var intersections = new OpenLayers.Layer.Vector("intersections", {
        projection: wgs,
        strategies: [new OpenLayers.Strategy.BBOX(), areaMapStrategy],
        protocol: new OpenLayers.Protocol.Script({
			url: "http://scottparker.cartodb.com/api/v2/sql",
            params: {q: "select * from intersections", format: "geojson"},
            format: geoJSONparser,
			callbackKey: "callback"
		}),
        styleMap: intersectionStyleMap
    });

    var selectControl = new OpenLayers.Control.SelectFeature(intersections, {
        autoActivate:true,
        onSelect: function(feature) {
			intersectionID = feature.attributes["node_id"];
			this.unselectAll();
			jQuery.mobile.changePage("#intersectionpage");
        }
	});

    var locate = new OpenLayers.Layer.Vector("Location range", {});
    var geolocate = new OpenLayers.Control.Geolocate({
        id: 'locate-control',
        geolocationOptions: {enableHighAccuracy: true,maximumAge: 0,timeout: 7000}
    });

    geolocate.events.register("locationupdated", this, function(e) {
        locate.removeAllFeatures();
        locate.addFeatures([new OpenLayers.Feature.Vector(e.point,{},{graphicName: 'cross',strokeColor: '#f00',strokeWidth: 2,fillOpacity: 0,pointRadius: 10})]);
        map.zoomToExtent(locate.getDataExtent());
    });

    map = new OpenLayers.Map({
        div: "map",
        theme: null,
        projection: wgs,
        numZoomLevels: 18,
        controls: [
            new OpenLayers.Control.Attribution(),
            new OpenLayers.Control.TouchNavigation({dragPanOptions: {enableKinetic: true}}),
            geolocate,
            selectControl
        ],
        layers: [
            new OpenLayers.Layer.OSM("OpenStreetMap", null, {transitionEffect: 'resize'}),
            locate,
            intersections
        ],
        center: new OpenLayers.LonLat(-13654000, 5705400),
        zoom:17
    });
};

/* initialize intersection detail page */
function initDetailMap() {
	detailMapStrategy = new OpenLayers.Strategy.Refresh();

	hiLite = new OpenLayers.Layer.Vector("hiLite",{styleMap: hiLiteStyleMap});
	rampAttrs = new OpenLayers.Layer.Vector("ramp_attributes",{styleMap: stateStyleMap});

	ramps = new OpenLayers.Layer.Vector("ramps", {
        projection: wgs,
		strategies: [new OpenLayers.Strategy.Fixed(), detailMapStrategy],
		protocol: new OpenLayers.Protocol.Script({
			url: "http://scottparker.cartodb.com/api/v2/sql",
			params: {q: "select * from ramps where nodeid = "+intersectionID+ " order by bearing asc, down_ramp asc", format: "geojson"},
			format: geoJSONparser,
			callbackKey: "callback"
		}),
        styleMap: rampStyleMap,
        eventListeners: {
			"featuresadded": function() {
				this.map.zoomToExtent(this.getDataExtent());
				hiLite.removeAllFeatures();
				rampAttrs.removeAllFeatures();
				var attributes;
				var stateAttrs;
				for (var i = 0; i< this.features.length; i++) {
					attributes = this.features[i].attributes;
					rampAttrs.addFeatures(new OpenLayers.Feature.Vector(this.features[i].geometry.clone()));
					attrs = rampAttrs.features[i].attributes;
					for (var attr in attributes){
						if (attr == 'bearing') {attrs.bearing = attributes[attr];}
						else if (attr == 'down_ramp') {attrs.down_ramp = attributes[attr];}
						else if (attr == 'st_name') {attrs.st_name = attributes[attr];}
						else if (attr == 'state') {attrs.state = attributes[attr];};
					}
					rampAttrs.drawFeature(rampAttrs.features[i]);
					hiLite.addFeatures(new OpenLayers.Feature.Vector(this.features[i].geometry.clone(),{activeOne: 0}));
				}
				currentRamp = 0;
				hiLite.features[currentRamp].attributes.activeOne = 1;
				hiLite.drawFeature(hiLite.features[currentRamp]);
				document.getElementById("street").innerHTML = rampAttrs.features[currentRamp].attributes.st_name;
			}
		}
    });
	
    i_map = new OpenLayers.Map({
        div: "i_map",
        theme: null,
        projection: sm,
        numZoomLevels: 18,
        controls: [
            new OpenLayers.Control.Attribution(),
            new OpenLayers.Control.TouchNavigation({dragPanOptions: {enableKinetic: true}})
        ],
        layers: [
            new OpenLayers.Layer.Bing({key:apiKey,type:"AerialWithLabels",name:"Bing Aerial + Labels",transitionEffect:'resize'}),
			hiLite,
            rampAttrs,
			ramps
        ],
        center: new OpenLayers.LonLat(-13654000, 5705400),
        zoom:18
    });
};

var moveCW = function() {
	hiLite.features[currentRamp].attributes.activeOne = 0; hiLite.drawFeature(hiLite.features[currentRamp]);
	currentRamp = (currentRamp == rampAttrs.features.length-1)?0:currentRamp+1;
	hiLite.features[currentRamp].attributes.activeOne = 1; hiLite.drawFeature(hiLite.features[currentRamp]);
	document.getElementById("street").innerHTML = rampAttrs.features[currentRamp].attributes.st_name;
};



  /*var cStyleMap = new OpenLayers.StyleMap({
        "default": {
            externalGraphic: "img/two_arrows_plain.png",
            //graphicWidth: 17,
            graphicHeight: 30,
            //graphicXOffset: 4,
            //graphicYOffset: 4,
            rotation: "jQuery{im_angle}", //the bearing for the image
			fillOpacity: 1 //"jQuery{opacity}"
            },
        "select": {
            cursor: "crosshair",
            //externalGraphic: "../img/marker.png"
            }
        }); */

/*function fixContentHeight() {
    var footer = jQuery("div[data-role='footer']:visible"),
        content = jQuery("div[data-role='content']:visible:visible"),
        viewHeight = jQuery(window).height(),
        contentHeight = viewHeight - footer.outerHeight();

    if ((content.outerHeight() + footer.outerHeight()) !== viewHeight) {
        contentHeight -= (content.outerHeight() - content.height() + 1);
        content.height(contentHeight);
    };

    if (window.map && window.map instanceof OpenLayers.Map) {
		map.updateSize();}
	else {
		initAreaMap();
	}; */
