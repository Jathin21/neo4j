import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { Neo4jGraphQL } from '@neo4j/graphql';
import neo4j from 'neo4j-driver';
import fs from 'fs/promises';

const typeDefs = await fs.readFile('./schema.graphql', { encoding: 'utf-8' });

const driver = neo4j.driver(
  'neo4j://24.144.81.178:7687',
  neo4j.auth.basic('neo4j', 'h6u4%krd')
);


try {
  const session = driver.session();
  const result = await session.run("RETURN 1 AS test");
  console.log("✅ Connected to Neo4j:", result.records[0].get("test"));
  await session.close();
} catch (err) {
  console.error("❌ Failed to connect to Neo4j:", err);
  process.exit(1);
}

//  Manually define resolvers BEFORE schema
const customResolvers = {
  Query: {
    recommend: async (_, { userId }) => {
      const session = driver.session();
      try {
        const result = await session.run(
          `
          MATCH (u:User {id: $userId})-[:BOUGHT|LIKED]->(:Product)<-[:BOUGHT|LIKED]-(o:User)-[:BOUGHT|LIKED]->(rec:Product)
          WHERE NOT (u)-[:BOUGHT|LIKED]->(rec)
          RETURN DISTINCT rec LIMIT 5
          `,
          { userId }
        );

        console.log("Records returned:", result.records.length);

        return result.records.map(record => {
          const rec = record.get("rec").properties;
          return {
            id: rec.id,
            name: rec.name,
            category: rec.category,
            price: rec.price?.toNumber?.() ?? rec.price
          };
        });
      } catch (err) {
        console.error("❌ Recommendation query failed:", err);
        return [];
      } finally {
        await session.close();
      }
    }
  }
};

// ✅ Inject resolvers into Neo4jGraphQL
const neoSchema = new Neo4jGraphQL({
  typeDefs,
  driver,
  resolvers: customResolvers
});

const schema = await neoSchema.getSchema();
const server = new ApolloServer({ schema });

const { url } = await startStandaloneServer(server, {
  listen: { port: 4000 }
});

console.log(`🚀 Server ready at ${url}`);
