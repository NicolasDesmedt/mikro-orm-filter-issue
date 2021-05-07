import { Options } from "@mikro-orm/core";
import {
  Connection,
  Entity,
  Filter,
  IDatabaseDriver,
  ManyToOne,
  MikroORM,
  PrimaryKey,
  Property,
} from "@mikro-orm/core";
import { expect } from "chai";

@Entity()
class User {
  constructor(name: string = "name") {
    this.firstName = this.lastName = name;
  }
  @PrimaryKey()
  public id!: number;

  @Property()
  public firstName!: string;

  @Property()
  public lastName!: string;
}

@Entity()
@Filter({
  name: "userfilter",
  cond: ({ search }, types) => ({
    user: {
      $or: [
        {
          firstName: search,
        },
        {
          lastName: search,
        },
      ],
    },
  }),
})
class Membership {
  constructor(user: User, role: string) {
    this.user = user;
    this.role = role;
  }
  @PrimaryKey()
  public id!: number;

  @ManyToOne(() => User)
  public user!: User;

  @Property()
  public role!: string;
}

describe("MikroORM filter + $or issue", () => {
  let orm: MikroORM<IDatabaseDriver<Connection>>;
  const dbName = "mikro-orm-filter-issue";

  before(async () => {
    orm = await MikroORM.init({
      debug: true,
      entities: [User, Membership],
      dbName,
      user: "root",
      password: "root",
      type: "postgresql",
    } as Options);

    await orm.getSchemaGenerator().dropDatabase(dbName);
    await orm.getSchemaGenerator().createDatabase(dbName);
    await orm.getSchemaGenerator().createSchema();

    const user = new User();
    const basicMembership = new Membership(user, "basic");
    const adminMembership = new Membership(user, "admin");
    orm.em.persist([user, basicMembership, adminMembership]);
    await orm.em.flush();
  });

  after(() => orm.close(true));

  describe("Should filter based on membership role and user name", async () => {
    it("Does not include role filter in query", async () => {
      const [allMems, brokenCount] = await orm.em.findAndCount(
        Membership,
        { $or: [{ role: "admin" }, { role: "moderator" }] },
        { filters: { userfilter: { search: "name" } } }
      );
      expect(brokenCount).to.be.equal(2);
    });

    it("Does include role filter in query", async () => {
      const [filteredMems, correctCount] = await orm.em.findAndCount(
        Membership,
        { $and: [{ $or: [{ role: "admin" }, { role: "moderator" }] }] },
        { filters: { userfilter: { search: "name" } } }
      );
      expect(correctCount).to.be.equal(1);
    });
  });
});
