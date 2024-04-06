import type {
  StyleSpecification,
  Evented,
} from "maplibre-gl"
import type {
} from "mapbox-gl"

import Point from "@mapbox/point-geometry"

export interface LngLat {
  lng: number
  lat: number
}

export type MapGeoJSONFeature = GeoJSON.Feature<GeoJSON.Geometry> & {
  layer: any
  source: string
  sourceLayer: string
  state: {[key: string]: any}
}

export interface MapInstance extends Evented {
  queryRenderedFeatures(geometry?: any, options?: any): any[]

  getContainer(): HTMLElement

  fitBounds(bounds: any, options?: any): this

  setMaxBounds(bounds: any): this

  getCanvas(): any

  getBounds(): any

  setCenter(center: any, eventData?: any): this

  getCenter(): any

  setZoom(zoom: any, options?: any): this

  getZoom(): any
}

export interface MapEvent<SourceT extends Evented, OriginalEventT = unknown> {
  type: string
  target: SourceT
  originalEvent: OriginalEventT
}

export type MapMouseEvent<MapT extends MapInstance> = MapEvent<MapT, MouseEvent> & {
  point: Point
  lngLat: LngLat
  features?: MapGeoJSONFeature[]
}

export interface IControl<MapT extends MapInstance = MapInstance> {
  onAdd(map: MapT): HTMLElement

  onRemove(map: MapT): void

  getDefaultPosition?: (() => string) | undefined
}

export interface NavigationControlInstance extends IControl {
  _container?: HTMLElement
}

export interface MapLib<MapT extends MapInstance> {
  supported?: (options: any) => boolean

  Map: {new (options: any): MapT}

  NavigationControl: {new (options: any): NavigationControlInstance}
}

export interface MinimapOptions {
  id?: string
  width?: string
  height?: string
  style: StyleSpecification | string

  center?: number[]
  zoomLevelOffset?: number
  maxBounds?: any

  lineColor?: string
  lineWidth?: number
  lineOpacity?: number
  fillColor?: string
  fillOpacity?: number
  dragPan?: boolean
  scrollZoom?: boolean
  boxZoom?: boolean
  dragRotate?: boolean
  keyboard?: boolean
  doubleClickZoom?: boolean
  touchZoomRotate?: boolean
  containerClass?: string
}