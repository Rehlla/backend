import { buildSchema } from 'graphql';
import { typeDefs } from './typeDefs';

/**
 * Built once at module load; buildSchema validates the SDL itself.
 *
 * Deliberately no @graphql-tools: its CJS require chain loaded a second
 * `graphql` instance under vitest (the classic "Cannot use GraphQLSchema from
 * another module or realm" error). One dependency, one instance, no realm
 * split — resolvers ride as the rootValue (see resolvers.ts).
 */
export const schema = buildSchema(typeDefs);
