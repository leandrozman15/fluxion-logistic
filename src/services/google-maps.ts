'use server';

/**
 * @fileOverview Servicio de integración con Google Maps Platform para logística.
 */

export interface RouteResult {
  durationMinutes: number;
  distanceKm: number;
  summary: string;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

/**
 * Calcula distancia y tiempo para una ruta con múltiples paradas.
 */
export async function calculateRouteDetails(points: string[], apiKey: string): Promise<RouteResult | null> {
  if (points.length < 2 || !apiKey) return null;

  const origin = points[0];
  const destination = points[points.length - 1];
  const waypoints = points.slice(1, -1).join('|');

  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints)}&key=${apiKey}&language=es&region=AR`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error("Google Maps API Status Error:", data.status, data.error_message);
      return null;
    }

    const route = data.routes[0];
    let totalDurationSeconds = 0;
    let totalDistanceMeters = 0;

    route.legs.forEach((leg: any) => {
      totalDurationSeconds += leg.duration.value;
      totalDistanceMeters += leg.distance.value;
    });

    return {
      durationMinutes: Math.round(totalDurationSeconds / 60),
      distanceKm: Math.round(totalDistanceMeters / 1000),
      summary: route.summary || "Ruta calculada vía Google Maps"
    };
  } catch (error) {
    console.error("Error calling Google Maps API:", error);
    return null;
  }
}

/**
 * Convierte una dirección de texto en coordenadas geográficas.
 */
export async function geocodeAddress(address: string, apiKey: string): Promise<GeocodeResult | null> {
  if (!address || !apiKey) return null;

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}&language=es&region=AR`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results[0]) {
      console.warn("Geocoding failed for address:", address, data.status);
      return null;
    }

    const result = data.results[0];
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formattedAddress: result.formatted_address
    };
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}
