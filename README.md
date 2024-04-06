# MapGL Minimap

mapgl-minimap is a minimap control for controlling your mapbox-gl-js or maplibre-gl-js maps.

## Usage

```javascript
var map = new maplibregl.Map({
  container: 'map',
  style: 'https://demotiles.maplibre.org/style.json',
  center: [-73.94656812952897, 40.72912351406106],
  zoom: 10
});

map.on('load', function () {
  const minimap = new Minimap(maplibregl, {
    center: [-73.94656812952897, 40.72912351406106],
    style: "https://demotiles.maplibre.org/style.json",
    toggleDisplay: true,
    zoom: 6
  });

  map.addControl(minimap, 'top-right');
});
```