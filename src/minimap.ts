import type {
  MapLib,
  MapMouseEvent,
  MapInstance,
  MinimapOptions,
  IControl
} from "./types"

export default class Minimap<
  MapT extends MapInstance
> implements IControl<MapT> {
  private mapGL!: MapLib<MapT>
  private options: MinimapOptions

  private container: HTMLDivElement | HTMLElement | null
  private map: MapT | null
  private minimap: MapT | null
  private minimapCanvas: HTMLCanvasElement | HTMLElement | null

  private toggleButton: HTMLAnchorElement | null

  private isCollapsed: boolean
  private isDragging: boolean
  private isCursorOverFeature: boolean

  private currentPoint: number[]
  private previousPoint: number[]
  private trackingRect: any
  private trackingRectCoordinates: number[][][]

  private onLoad: () => void

  private onToggle: () => void

  private onMainMapMove: () => void
  private onMainMapMoveEnd: () => void

  private onMouseMove: (e: MapMouseEvent<MapT>) => void
  private onMouseDown: (e: MapMouseEvent<MapT>) => void
  private onMouseUp: () => void

  constructor(mapgl: MapLib<MapT>, config?: MinimapOptions) {
    this.mapGL = mapgl

    this.map = null
    this.minimap = null
    this.container = null
    this.minimapCanvas = null

    this.toggleButton = null

    this.isCollapsed = false
    this.isDragging = false
    this.isCursorOverFeature = false
    this.currentPoint = [0, 0]
    this.previousPoint = [0, 0]
    this.trackingRectCoordinates = [[[], [], [], [], []]]

    this.onLoad = this.load.bind(this)

    this.onToggle = this.toggle.bind(this)

    this.onMainMapMove = this.update.bind(this)
    this.onMainMapMoveEnd = this.mapMoved.bind(this)

    this.onMouseMove = this.mouseMove.bind(this)
    this.onMouseDown = this.mouseDown.bind(this)
    this.onMouseUp = this.mouseUp.bind(this)

    this.options = {
      id: "mapgl-minimap",
      width: "320px",
      height: "180px",
      style: {
        version: 8,
        sources: {},
        layers: []
      },
      center: [0, 0],

      zoomLevelOffset: -3,

      lineColor: "#136a7e",
      lineWidth: 1,
      lineOpacity: 1,

      fillColor: "#d77a34",
      fillOpacity: 0.25,

      toggleDisplay: false,
      dragPan: false,
      scrollZoom: false,
      boxZoom: false,
      dragRotate: false,
      keyboard: false,
      doubleClickZoom: false,
      touchZoomRotate: false
    }

    if (config) {
      Object.assign(this.options, config)
    }
  }

  onAdd(map: MapT): HTMLElement {
    this.map = map

    this.container = this.createContainer(map)

    const opts = this.options
    const minimap = this.minimap = new this.mapGL.Map({
      attributionControl: false,
      container: this.container,
      style: opts.style,
      center: opts.center,
      trackResize: false,
    })


    this.zoomAdjust()

    if (opts.maxBounds) minimap.setMaxBounds(opts.maxBounds)

    minimap.getCanvas().removeAttribute("tabindex")

    minimap.on("load", this.onLoad)

    this.enableToggle()

    return this.container
  }

  onRemove(): void {
    if (this.map)
      this.map.off("move", this.onMainMapMove)

    if (this.minimap) {
      this.minimap.off("mousemove", this.onMouseMove)
      this.minimap.off("mousedown", this.onMouseDown)
      this.minimap.off("mouseup", this.onMouseUp)

      this.minimap.off("touchmove", this.onMouseMove)
      this.minimap.off("touchstart", this.onMouseDown)
      this.minimap.off("touchend", this.onMouseUp)
    }

    if (this.minimapCanvas) {
      this.minimapCanvas.removeEventListener("wheel", this.preventDefault)
      this.minimapCanvas.removeEventListener("mousewheel", this.preventDefault)
    }

    if (this.toggleButton) {
      this.toggleButton.removeEventListener("click", this.preventDefault)
      this.toggleButton.removeEventListener("click", this.onToggle)
    }

    if (this.container) {
      this.container.removeEventListener("contextmenu", this.preventDefault)

      if (this.toggleButton) this.container.removeChild(this.toggleButton)
      const parentNode = this.container.parentNode
      if (parentNode)
        parentNode.removeChild(this.container)
    }

    this.minimap = null
  }

  private load(): void {
    const opts: any = this.options
    const map: any = this.map
    const minimap: any = this.minimap
    const interactions = [
      "dragPan", "scrollZoom", "boxZoom", "dragRotate",
      "keyboard", "doubleClickZoom", "touchZoomRotate"
    ]

    for(const interaction of interactions) {
      if (!opts[interaction]) {
        minimap[interaction].disable()
      }
    }

    // remove any trackingRect already loaded layers or sources
    if (minimap.getLayer("trackingRectOutline")) {
      minimap.removeLayer("trackingRectOutline")
    }

    if (minimap.getLayer("trackingRectFill")) {
      minimap.removeLayer("trackingRectFill")
    }

    if (minimap.getSource("trackingRect")) {
      minimap.removeSource("trackingRect")
    }

    // Add trackingRect sources and layers
    minimap.addSource("trackingRect", {
      "type": "geojson",
      "data": {
        "type": "Feature",
        "properties": {
          "name": "trackingRect"
        },
        "geometry": {
          "type": "Polygon",
          "coordinates": this.trackingRectCoordinates
        }
      }
    })

    minimap.addLayer({
      "id": "trackingRectOutline",
      "type": "line",
      "source": "trackingRect",
      "layout": {},
      "paint": {
        "line-color": opts.lineColor,
        "line-width": opts.lineWidth,
        "line-opacity": opts.lineOpacity
      }
    })

    // needed for dragging
    minimap.addLayer({
      "id": "trackingRectFill",
      "type": "fill",
      "source": "trackingRect",
      "layout": {},
      "paint": {
        "fill-color": opts.fillColor,
        "fill-opacity": opts.fillOpacity
      }
    })

    this.trackingRect = minimap.getSource("trackingRect")
    this.update()


    map.on("move", this.onMainMapMove)
    map.on("moveend", this.onMainMapMoveEnd)

    minimap.on("mousemove", this.onMouseMove)
    minimap.on("mousedown", this.onMouseDown)
    minimap.on("mouseup", this.onMouseUp)

    minimap.on("touchmove", this.onMouseMove)
    minimap.on("touchstart", this.onMouseDown)
    minimap.on("touchend", this.onMouseUp)

    this.minimapCanvas = minimap.getCanvasContainer()
    if (!this.minimapCanvas) return
    this.minimapCanvas.addEventListener("wheel", this.preventDefault)
    this.minimapCanvas.addEventListener("mousewheel", this.preventDefault)
  }

  private mouseDown(e: MapMouseEvent<MapT>): void {
    if (this.isCursorOverFeature) {
      this.isDragging = true
      this.previousPoint = this.currentPoint
      this.currentPoint = [e.lngLat.lng, e.lngLat.lat]
    }
  }

  toggle(): void {
    !this.isCollapsed ? this.collapse() : this.expand()
  }

  private collapse(): void {
    if (!this.container) return
    if (!this.toggleButton) return

    const opts = this.options

    if (opts.toggleDisplay) {
      this.container.style.width = "24px"
      this.container.style.height = "24px"
      // this.toggleButton.style.backgroundColor = opts.lineColor || "#136a7e"
      this.toggleButton.innerHTML = "<svg xmlns='http://www.w3.org/2000/svg' height='24' viewBox='0 -960 960 960' width='24'><path d='M200-200v-240h80v160h160v80H200Zm480-320v-160H520v-80h240v240h-80Z'/></svg>"
      this.isCollapsed = true
    }
  }

  private expand(): void {
    if (!this.container) return
    if (!this.toggleButton) return

    const opts = this.options

    if (opts.toggleDisplay) {
      this.container.style.width = opts.width || "320px"
      this.container.style.height = opts.height || "180px"
      this.toggleButton.innerHTML = "<svg xmlns='http://www.w3.org/2000/svg' height='24' viewBox='0 -960 960 960' width='24' style='fillColor: inherit'><path d='M440-440v240h-80v-160H200v-80h240Zm160-320v160h160v80H520v-240h80Z'/></svg>"
      this.isCollapsed = false
    }
  }

  private mouseMove(e: MapMouseEvent<MapT>): void {
    if (!this.minimapCanvas) return
    if (!this.minimap) return
    if (!this.map) return

    const features = this.minimap.queryRenderedFeatures(e.point, {
      layers: ["trackingRectFill"]
    })

    // don't update if we're still hovering the area
    if (!(this.isCursorOverFeature && features.length > 0)) {
      this.isCursorOverFeature = features.length > 0
      this.minimapCanvas.style.cursor = this.isCursorOverFeature ? "move" : ""
    }

    if (this.isDragging) {
      this.previousPoint = this.currentPoint
      this.currentPoint = [e.lngLat.lng, e.lngLat.lat]

      const offset = [
        this.previousPoint[0] - this.currentPoint[0],
        this.previousPoint[1] - this.currentPoint[1]
      ]

      const newBounds = this.moveTrackingRect(offset)

      this.map.fitBounds(newBounds, {
        duration: 80
      })
    }
  }

  private mouseUp(): void {
    this.isDragging = false
  }

  private moveTrackingRect(offset: number[]) {
    if (!this.trackingRect) return

    const source = this.trackingRect
    const data = source._data

    if (!data) return
    const bounds = data.properties.bounds

    bounds._ne.lat -= offset[1]
    bounds._ne.lng -= offset[0]
    bounds._sw.lat -= offset[1]
    bounds._sw.lng -= offset[0]

    // convert bounds to points for trackingRect
    this.convertBoundsToPoints(bounds)

    // restrict bounds to max lat/lng before setting layer data
    bounds._ne.lat = Math.min(bounds._ne.lat, 90)
    bounds._ne.lng = Math.min(bounds._ne.lng, 180)
    bounds._sw.lat = Math.max(bounds._sw.lat, -90)
    bounds._sw.lng = Math.max(bounds._sw.lng, -180)

    source.setData(data)

    return bounds
  }

  private setTrackingRectBounds(): void {
    if (!this.map) return

    const bounds = this.map.getBounds()
    const source = this.trackingRect

    if (!source) return

    const data = source._data

    data.properties.bounds = bounds
    this.convertBoundsToPoints(bounds)
    source.setData(data)
  }

  convertBoundsToPoints(bounds: any): void {
    const ne = bounds._ne
    const sw = bounds._sw
    const trc = this.trackingRectCoordinates

    trc[0][0][0] = ne.lng
    trc[0][0][1] = ne.lat
    trc[0][1][0] = sw.lng
    trc[0][1][1] = ne.lat
    trc[0][2][0] = sw.lng
    trc[0][2][1] = sw.lat
    trc[0][3][0] = ne.lng
    trc[0][3][1] = sw.lat
    trc[0][4][0] = ne.lng
    trc[0][4][1] = ne.lat
  }

  private update(): void {
    if (this.isDragging) return

    this.zoomAdjust()
    this.setTrackingRectBounds()
  }

  private mapMoved(): void {
    if (this.minimap && this.map)
      this.minimap.setCenter(this.map.getCenter())
  }

  private zoomAdjust(): void {
    if (this.minimap && this.map)
      this.minimap.setZoom(this.map.getZoom() + this.options.zoomLevelOffset)
  }

  private createContainer(map: MapT): HTMLDivElement {
    const opts = this.options
    const container = document.createElement("div")

    container.className = "mapgl-minimap maplibregl-ctrl mapboxgl-ctrl"
    if (opts.containerClass) container.classList.add(opts.containerClass)
    container.setAttribute(
      "style",
      "box-sizing: content-box; box-shadow: 0 1px 5px rgba(0, 0, 0, 0.65); border: 3px solid white; width: " + opts.width + "; height: " + opts.height + ";"
    )
    container.style.transition = "height 0.6s, width 0.6s"
    container.addEventListener("contextmenu", this.preventDefault)

    map.getContainer().appendChild(container)

    if( opts.id && opts.id.length > 0) {
      container.id = opts.id
    }

    return container
  }

  private enableToggle(): void {
    if (!this.container) return
    const opts = this.options
    if (!opts.toggleDisplay) return

    this.toggleButton = this.createToggleButton()

    this.container.appendChild(this.toggleButton)

    this.toggleButton.setAttribute(
      "style",
      "position: absolute; top: 0; right: 0;z-index: 1000; margin:0; background-color: white;"
    )
    this.toggleButton.style.width = "24px"
    this.toggleButton.style.height = "24px"
    this.toggleButton.style.display = "block"
  }

  private createToggleButton(): HTMLAnchorElement {
    const opts = this.options
    const button = document.createElement("a")
    button.innerHTML = "<svg xmlns='http://www.w3.org/2000/svg' height='24' viewBox='0 -960 960 960' width='24' style='fillColor: inherit'><path d='M440-440v240h-80v-160H200v-80h240Zm160-320v160h160v80H520v-240h80Z'/></svg>"
    button.className = "mapgl-minimap maplibregl-ctrl mapboxgl-ctrl"
    button.style.margin = "0"
    button.style.display = "block"
    button.style.backgroundColor = opts.lineColor || "#136a7e"
    button.style.fill = opts.fillColor || "#d77a34"
    button.href = "#"

    button.addEventListener("click", this.preventDefault)
    // Enable button toggle
    button.addEventListener("click", this.onToggle)
    return button
  }

  private preventDefault(e: Event): void {
    e.preventDefault()
  }
}
