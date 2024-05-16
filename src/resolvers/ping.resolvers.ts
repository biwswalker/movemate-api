import {
    Resolver,
    Query,
} from "type-graphql";

@Resolver()
export default class PingResolver {
    @Query(() => String)
    async ping(): Promise<String> {
        return 'ping';
    }
}