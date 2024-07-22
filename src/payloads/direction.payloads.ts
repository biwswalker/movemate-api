import { GraphQLJSONObject } from "graphql-type-json";
import { Field, Float, ObjectType } from "type-graphql";

@ObjectType()
class Distance {
    @Field()
    text: string;

    @Field()
    value: number;
}

@ObjectType()
class Duration {
    @Field()
    text: string;

    @Field()
    value: number;
}

@ObjectType()
class Time {
    @Field()
    text: string;

    @Field()
    time_zone: string;

    @Field(() => Date)
    value: Date;
}

@ObjectType()
class DirectionsPolyline {
    @Field()
    points: string;
}

@ObjectType()
class DirectionsStep {
    @Field(() => Distance, { nullable: true })
    distance?: Distance // google.maps.Distance;

    @Field(() => Duration, { nullable: true })
    duration?: Duration // google.maps.Duration;

    @Field({ nullable: true })
    encoded_lat_lngs: string;

    @Field(() => GraphQLJSONObject, { nullable: true })
    end_location: any // google.maps.LatLng;

    @Field(() => GraphQLJSONObject, { nullable: true })
    end_point: any // google.maps.LatLng;

    @Field({ nullable: true })
    instructions?: string;

    @Field({ nullable: true })
    html_instructions?: string;

    @Field(() => [GraphQLJSONObject], { nullable: true })
    lat_lngs: any[] // google.maps.LatLng[];

    @Field({ nullable: true })
    maneuver: string;

    @Field(() => [GraphQLJSONObject], { nullable: true })
    path: any[] // google.maps.LatLng[];

    @Field(() => DirectionsPolyline, { nullable: true })
    polyline?: DirectionsPolyline // google.maps.DirectionsPolyline;

    @Field(() => GraphQLJSONObject, { nullable: true })
    start_location: any // google.maps.LatLng;

    @Field(() => GraphQLJSONObject, { nullable: true })
    start_point: any // google.maps.LatLng;
    /**
     * Sub-steps of this step. Specified for non-transit sections of transit
     * routes.
     */
    @Field(() => [DirectionsStep], { nullable: true })
    steps?: DirectionsStep[] // google.maps.DirectionsStep[];

    @Field(() => GraphQLJSONObject, { nullable: true })
    transit?: any // google.maps.TransitDetails;

    @Field(() => GraphQLJSONObject, { nullable: true })
    transit_details?: any // google.maps.TransitDetails;

    @Field(() => String, { nullable: true })
    travel_mode: string // google.maps.TravelMode;
}

@ObjectType()
class DirectionsLeg {

    @Field(() => Time, { nullable: true })
    arrival_time?: Time // google.maps.Time;

    @Field(() => Time, { nullable: true })
    departure_time?: Time // google.maps.Time;

    @Field(() => Distance, { nullable: true })
    distance?: Distance // google.maps.Distance;

    @Field(() => Duration, { nullable: true })
    duration?: Duration // google.maps.Duration;

    @Field(() => Duration, { nullable: true })
    duration_in_traffic?: Duration // google.maps.Duration;

    @Field()
    end_address: string;

    @Field(() => GraphQLJSONObject)
    end_location: any // google.maps.LatLng;

    @Field()
    start_address: string;

    @Field(() => GraphQLJSONObject)
    start_location: any // google.maps.LatLng;

    @Field(() => [DirectionsStep])
    steps: DirectionsStep[];

    @Field(() => [GraphQLJSONObject])
    traffic_speed_entry: any[];

    @Field(() => [GraphQLJSONObject], { nullable: true })
    via_waypoints: any[] // google.maps.LatLng[];
}

@ObjectType()
class DirectionsRoute {

    @Field(() => GraphQLJSONObject)
    bounds: any // google.maps.LatLngBounds;

    @Field()
    copyrights: string;

    @Field(() => GraphQLJSONObject, { nullable: true })
    fare?: any // google.maps.TransitFare;

    // TODO:
    @Field(() => [DirectionsLeg], { nullable: true })
    legs?: DirectionsLeg[];

    @Field(() => [GraphQLJSONObject], { nullable: true })
    overview_path: any[] // google.maps.LatLng[];

    @Field(() => GraphQLJSONObject)
    overview_polyline: any;

    @Field()
    summary: string;

    @Field(() => [String])
    warnings: string[];

    @Field(() => [Float])
    waypoint_order: number[];
}

@ObjectType()
export class DirectionsResultPayload {
    @Field(() => [String], { nullable: true })
    available_travel_modes?: string[] // google.maps.TravelMode[]

    @Field(() => [GraphQLJSONObject], { nullable: true })
    geocoded_waypoints?: any[] // google.maps.DirectionsGeocodedWaypoint[]

    @Field(() => GraphQLJSONObject, { nullable: true })
    request?: any // google.maps.DirectionsRequest

    @Field(() => [GraphQLJSONObject], { nullable: true })
    routes: any[];

    @Field({ nullable: true })
    status?: string
}