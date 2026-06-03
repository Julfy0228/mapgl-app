import { useEffect, useMemo, useRef } from 'react'
import { load } from '@2gis/mapgl'
import type { Map as MapglMap } from '@2gis/mapgl/types'
import type { Label as MapglLabel } from '@2gis/mapgl/types'
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry, Point } from 'geojson'
import dtpDataRaw from './data/dtp-tula.geojson?raw'
import './App.css'

const TULA_CENTER: [number, number] = [37.617348, 54.193122]
const LIGHT_STYLE_ID = '7a07c1a4-25cf-4390-9dd3-db3a7ba9bb1d'
const HEATMAP_LAYER_ID = 'tula-dtp-heatmap-layer'
const LABEL_BACKGROUND_IMAGE = '/label-bg.svg'

function toMapglPoints(data: FeatureCollection): FeatureCollection<Point, GeoJsonProperties> {
  return {
    type: 'FeatureCollection',
    features: data.features
      .map((feature): Feature<Point, GeoJsonProperties> | null => {
        if (feature.geometry?.type === 'Point') {
          return feature as Feature<Point, GeoJsonProperties>
        }

        const point = feature.properties?.point as { lat?: number; long?: number } | undefined
        if (typeof point?.lat !== 'number' || typeof point.long !== 'number') {
          return null
        }

        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [point.long, point.lat],
          },
          properties: feature.properties,
        }
      })
      .filter((feature): feature is Feature<Point, GeoJsonProperties> => feature !== null),
  }
}

function addDtpLayers(map: MapglMap) {
  if (!map.hasLayer(HEATMAP_LAYER_ID)) {
    map.addLayer({
      id: HEATMAP_LAYER_ID,
      filter: ['match', ['sourceAttr', 'purpose'], ['tula-dtp'], true, false],
      type: 'heatmap',
      style: {
        color: [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0,
          'rgba(0, 0, 0, 0)',
          0.25,
          'rgba(66, 153, 225, 0.55)',
          0.45,
          'rgba(56, 178, 172, 0.75)',
          0.65,
          'rgba(246, 173, 85, 0.9)',
          0.85,
          'rgba(229, 62, 62, 0.95)',
          1,
          'rgba(255, 255, 255, 1)',
        ],
        radius: ['interpolate', ['linear'], ['zoom'], 9, 14, 13, 28, 16, 44],
        intensity: 0.9,
        opacity: 0.8,
        weight: ['match', ['get', 'severity'], ['Тяжёлый', 'С погибшими'], 2, 1],
        downscale: 1,
      },
    })
  }

}

function createDtpLabels(
  mapgl: Awaited<ReturnType<typeof load>>,
  map: MapglMap,
  points: FeatureCollection<Point, GeoJsonProperties>,
): MapglLabel[] {
  return points.features
    .map((feature) => {
      const category = feature.properties?.category
      if (typeof category !== 'string' || category.length === 0) {
        return null
      }

      return new mapgl.Label(map, {
        coordinates: feature.geometry.coordinates,
        text: category,
        image: {
          url: LABEL_BACKGROUND_IMAGE,
          size: [160, 18],
          stretchX: [[8, 152]],
          stretchY: [[6, 12]],
          padding: [-37, 8, -37, 8],
        },
        minZoom: 14,
        color: '#000000',
        fontSize: 10,
        haloColor: '#ffffff',
        haloRadius: 0,
        lineHeight: 10,
        offset: [0, 0],
        relativeAnchor: [0.5, 0.5],
        zIndex: 100,
        labeling: {
          type: 'pointLabelsOnly',
        },
      })
    })
    .filter((label): label is MapglLabel => label !== null)
}

function App() {
  const mapRef = useRef<MapglMap | null>(null)
  const apiKey = import.meta.env.VITE_2GIS_API_KEY
  const dtpPoints = useMemo(
    () => toMapglPoints(JSON.parse(dtpDataRaw) as FeatureCollection<Geometry, GeoJsonProperties>),
    [],
  )

  useEffect(() => {
    let destroyed = false
    let map: MapglMap | null = null
    let labels: MapglLabel[] = []

    load()
      .then((mapgl) => {
        if (destroyed) {
          return
        }

        map = new mapgl.Map('map-container', {
          center: TULA_CENTER,
          zoom: 12,
          pitch: 25,
          rotation: -15,
          key: apiKey,
          style: LIGHT_STYLE_ID,
          trafficControl: false,
          trafficOn: false,
          enableTrackResize: true,
        })
        mapRef.current = map

        new mapgl.GeoJsonSource(map, {
          data: dtpPoints,
          attributes: {
            purpose: 'tula-dtp',
          },
        })

        map.on('styleload', () => {
          if (!map) {
            return
          }

          addDtpLayers(map)
          labels.forEach((label) => label.destroy())
          labels = createDtpLabels(mapgl, map, dtpPoints)
        })
      })

    return () => {
      destroyed = true
      labels.forEach((label) => label.destroy())
      map?.destroy()
      mapRef.current = null
    }
  }, [apiKey, dtpPoints])

  return (
    <main className="app">
      <section className="map-section" aria-label="Карта ДТП Тулы">
        <div id="map-container" />
      </section>
    </main>
  )
}

export default App
