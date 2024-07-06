import axios from "axios";
import { GOOGLEAPI_AUTOCOMPLETE, GOOGLEAPI_DIRECTIONS, GOOGLEAPI_GEOCODE } from "./constants";
import { Location } from "@models/location.model";
import { get, map } from 'lodash'
import MarkerModel, { Marker } from "@models/marker.model";
import LocationAutocompleteModel, { LocationAutocomplete } from "@models/locationAutocomplete.model";

/**
 * 
 * @param query for search location
 * @url Document - https://developers.google.com/maps/documentation/places/web-service/place-autocomplete
 * @returns locations
 */
export async function getAutocomplete(query: string, latitude: number, longitude: number): Promise<LocationAutocomplete[]> {

    const request = {
        input: query,
        regionCode: 'th',
        languageCode: 'th',
        includedRegionCodes: ['th'],
        locationBias: { circle: { center: { latitude, longitude }, radius: 500 } }
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
    return locations
}

/**
 * 
 * @param placeId for get place detail
 * @url Document - https://developers.google.com/maps/documentation/places/web-service/place-details
 */
export async function getPlaceLocationDetail(placeId: string): Promise<Marker> {
    const place = new google.maps.places.Place({ id: placeId, requestedLanguage: 'th' });

    await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] });

    console.log(place.displayName);
    console.log(place.formattedAddress);

    return new MarkerModel({
        latitude: place.location.lat(),
        longitude: place.location.lng(),
        displayName: place.displayName,
        formattedAddress: place.formattedAddress,
    })
}

export async function getGeocode(latitude: number, longitude: number) {

    const response = await axios.get(GOOGLEAPI_GEOCODE, {
        params: {
            latlng: `${latitude},${longitude}`,
            key: process.env.GOOGLE_MAP_API_KEY,
        },
    });
    const result = response.data.results[0]
    const location = new Location()
    location.name = result.formatted_address
    location.latitude = latitude
    location.longitude = longitude

    return location
}

export async function getCalculateRoute(origin: string, destinations: string[]) {

    const waypoints = destinations.slice(0, -1).join('|');
    const finalDestination = destinations[destinations.length - 1];

    const response = await axios.get(GOOGLEAPI_DIRECTIONS, {
        params: {
            origin,
            destination: finalDestination,
            waypoints: waypoints ? `optimize:true|${waypoints}` : undefined,
            key: process.env.GOOGLE_MAP_API_KEY,
        },
    });

    const routesData = response.data.routes[0].legs.map((leg: any) => ({
        distance: leg.distance.text,
        duration: leg.duration.text,
        endAddress: leg.end_address,
        startAddress: leg.start_address,
        steps: leg.steps.map((step: any) => step.html_instructions),
    }));

    return routesData
}


