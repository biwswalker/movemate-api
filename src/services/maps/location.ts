import axios from "axios";
import { GOOGLEAPI_AUTOCOMPLETE, GOOGLEAPI_DIRECTIONS, GOOGLEAPI_GEOCODE, GOOGLEAPI_PLACE_DETAIL, GOOGLEAPI_ROUTE_DIRECTIONS } from "./constants";
import { get, map } from 'lodash'
import MarkerModel, { Marker } from "@models/marker.model";
import LocationAutocompleteModel, { LocationAutocomplete } from "@models/locationAutocomplete.model";
import { loadCache, saveCache } from "@configs/cache";
import logger from "@configs/logger";
import { LocationInput } from "@inputs/location.input";

const removePlusCode = (formattedAddress: string) => {
    if (formattedAddress) {
        // Split the address into parts
        const parts = formattedAddress.split(' ');
        // Check if the first part is a Plus Code by using a regex pattern
        const plusCodePattern = /^[A-Z0-9\+]+$/;
        // Plus Codes are typically alphanumeric and contain a '+' sign
        if (parts[0].match(plusCodePattern) && parts[0].includes('+')) {
            parts.shift(); // Remove the first part if it's a Plus Code
        }
        // Join the remaining parts back into a single string
        const cleanedAddress = parts.join(' ');
        return cleanedAddress;
    }
    return ''
};

/**
 * 
 * @param query for search location
 * @url Document - https://developers.google.com/maps/documentation/places/web-service/place-autocomplete
 * @returns locations
 */
export async function getAutocomplete(query: string, latitude: number, longitude: number, session?: string): Promise<LocationAutocomplete[]> {
    // Get cache
    const cacheType = 'places';
    const key = `${query}:${latitude}:${longitude}`;
    const cached = await loadCache(cacheType, key);
    if (cached) {
        logger.info('Cache hit for searchLocations');
        return cached;
    }
    // ------

    const request = {
        input: query,
        regionCode: 'th',
        languageCode: 'th',
        includedRegionCodes: ['th'],
        locationBias: { circle: { center: { latitude, longitude }, radius: 500 } },
        ...(session ? { sessionToken: session } : {})
    }

    const response = await axios.post<{ suggestions: google.maps.places.AutocompleteSuggestion[] }>(
        GOOGLEAPI_AUTOCOMPLETE,
        request,
        { headers: { 'X-Goog-Api-Key': process.env.GOOGLE_MAP_API_KEY } }
    )
    const locations = map<google.maps.places.AutocompleteSuggestion, LocationAutocomplete>(response.data.suggestions, (suggestion) => {
        const placePrediction = suggestion.placePrediction
        return new LocationAutocompleteModel({
            name: placePrediction.text.text,
            description: get(placePrediction, 'structuredFormat.secondaryText.text', ''),
            placeId: placePrediction.placeId,
        })
    })

    await saveCache(cacheType, key, locations);
    return locations
}

/**
 * 
 * @param placeId for get place detail
 * @url Document - https://developers.google.com/maps/documentation/places/web-service/place-details
 */
export async function getPlaceLocationDetail(placeId: string, session?: string): Promise<Marker> {
    // Get cache
    const cacheType = 'place-detail';
    const cached = await loadCache(cacheType, placeId);
    if (cached) {
        logger.info('Cache hit for locationMarker');
        return cached;
    }
    // ------

    const params = { languageCode: 'th', regionCode: 'th', fields: '*', ...(session ? { sessionToken: session } : {}) }
    const headers = { 'X-Goog-Api-Key': process.env.GOOGLE_MAP_API_KEY }
    const response = await axios.get<google.maps.places.Place>(`${GOOGLEAPI_PLACE_DETAIL}/${placeId}`, { params, headers })

    const { displayName, formattedAddress, location } = response.data

    const marker = new MarkerModel({
        placeId,
        displayName: removePlusCode(get(displayName, 'text', '') || displayName),
        formattedAddress: removePlusCode(formattedAddress),
        latitude: get(location, 'latitude', undefined) || location.lat(),
        longitude: get(location, 'longitude', undefined) || location.lng(),
    })

    await saveCache(cacheType, placeId, marker);

    return marker
}

/**
 * 
 * @param latitude 
 * @param longitude 
 * @param session 
 * @returns 
 * @url Document - https://developers.google.com/maps/documentation/geocoding/address-descriptors/requests-address-descriptors
 */
export async function getGeocode(latitude: number, longitude: number, session?: string) {
    // Get cache
    const cacheType = 'geocode';
    const key = `${latitude}:${longitude}`;
    const cached = await loadCache(cacheType, key);
    if (cached) {
        logger.info('Cache hit for getLocationByCoords');
        return cached;
    }
    // ------

    const response = await axios.get<google.maps.GeocoderResponse>(GOOGLEAPI_GEOCODE, {
        params: {
            latlng: `${latitude},${longitude}`,
            key: process.env.GOOGLE_MAP_API_KEY,
            language: 'th',
            region: 'th',
            extra_computations: 'ADDRESS_DESCRIPTORS',
            ...(session ? { sessionToken: session } : {})
        },
    });

    const result = get(response, 'data.results.0')
    const places = await getPlaceLocationDetail(result.place_id, session)

    await saveCache(cacheType, key, places);

    return places
}

// TODO: Can not using with Client
export async function getRoute(origin: LocationInput, destinations: LocationInput[]) {
    // Get cache
    const cacheType = 'routes';
    const key = `${origin.latitude}:${origin.longitude}:${destinations.map(desti => `${desti.latitude}:${desti.longitude}`).join(':')}`;
    const cached = await loadCache(cacheType, key);
    if (cached) {
        logger.info('Cache hit for getRoute');
        console.log('cached:', JSON.stringify(cached))
        return cached;
    }
    // ------

    const originStr = `${origin.latitude},${origin.longitude}`;
    const waypointsStrArray = destinations.map(point => `${point.latitude},${point.longitude}`)

    const waypoints = waypointsStrArray.slice(0, -1).join('|');
    const finalDestination = waypointsStrArray[waypointsStrArray.length - 1];

    const response = await axios.get<google.maps.DirectionsResult>(GOOGLEAPI_DIRECTIONS, {
        params: {
            origin: originStr,
            destination: finalDestination,
            waypoints: waypoints ? `optimize:true|${waypoints}` : undefined,
            key: process.env.GOOGLE_MAP_API_KEY,
            avoid: "tolls", // TODO: Possible to add config of admin web e.g. tolls|highways|ferries|indoor
            mode: 'driving',
            language: 'th',
            region: 'th',
            units: 'metric'
        },
    });

    const data = response.data
    console.log('\n', JSON.stringify(data), '\n')
    await saveCache(cacheType, key, data)
    return data
}

// Unused
export async function getRouteCompute(origin: LocationInput, destinations: LocationInput[]) {
    const waypoints = destinations.slice(0, -1)
    const destination = destinations[destinations.length - 1];

    const data = {
        origin: { location: { latLng: origin } },
        destination: { location: { latLng: destination } },
        ...(waypoints ? { intermediates: waypoints.map((point) => ({ location: { latLng: point } })) } : {}),
        travelMode: "DRIVE",
        routeModifiers: {
            avoidTolls: false,
            avoidHighways: false,
            avoidFerries: false
        },
        languageCode: "th-TH",
        regionCode: 'th',
        units: "METRIC"
    }
    const headers = { 'X-Goog-Api-Key': process.env.GOOGLE_MAP_API_KEY, 'X-Goog-FieldMask': '*' }

    const response = await axios.post<google.maps.DirectionsResult>(GOOGLEAPI_ROUTE_DIRECTIONS, data, { headers });

    const resp = response.data

    console.log('\n', JSON.stringify(data), '\n')

    return resp
}


