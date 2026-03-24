import bcrypt from "bcryptjs";
import prismaClientModule from "@prisma/client";

const PrismaClient = (prismaClientModule as unknown as { PrismaClient: new () => any }).PrismaClient;

const prisma = new PrismaClient();

const permissionKeys = [
  ["users.approve", "Approve or reject resident registrations"],
  ["users.manage", "Manage residents and assign roles"],
  ["roles.manage", "Create roles and edit permissions"],
  ["posts.create", "Create community posts"],
  ["posts.comment", "Comment on posts"],
  ["messages.read", "Read private and group messages"],
  ["messages.create", "Send private and group messages"],
  ["events.create", "Create and manage community events"],
  ["polls.create", "Create polls"],
  ["polls.vote", "Vote on polls"],
  ["posts.report", "Report inappropriate posts/comments/users"],
  ["moderation.manage", "Review and resolve moderation reports"],
  ["directory.manage", "Manage resident directory visibility"],
  ["documents.manage", "Create and update community documents"],
  ["documents.read", "Read and acknowledge documents"],
  ["alerts.create", "Create emergency alerts"],
  ["alerts.read", "Read emergency alerts"],
  ["notifications.manage", "Manage push tokens and notifications"]
] as const;

async function main() {
  const permissions = await Promise.all(
    permissionKeys.map(([key, description]) =>
      prisma.permission.upsert({
        where: { key },
        update: { description },
        create: { key, description }
      })
    )
  );

  const roleDefinitions = [
    {
      name: "admin",
      description: "Property manager / full control",
      permissionKeys: permissionKeys.map(([key]) => key)
    },
    {
      name: "community_manager",
      description: "Community manager",
      permissionKeys: [
        "users.approve",
        "posts.create",
        "posts.comment",
        "messages.read",
        "messages.create",
        "events.create",
        "polls.create",
        "polls.vote",
        "posts.report",
        "moderation.manage",
        "documents.manage",
        "documents.read",
        "alerts.create",
        "alerts.read",
        "notifications.manage"
      ]
    },
    {
      name: "resident",
      description: "Approved resident",
      permissionKeys: [
        "posts.create",
        "posts.comment",
        "posts.report",
        "messages.read",
        "messages.create",
        "polls.vote",
        "documents.read",
        "alerts.read"
      ]
    }
  ];

  for (const roleDef of roleDefinitions) {
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: { description: roleDef.description },
      create: { name: roleDef.name, description: roleDef.description }
    });

    for (const key of roleDef.permissionKeys) {
      const permission = permissions.find((item: { key: string }) => item.key === key);
      if (!permission) continue;

      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id }
      });
    }
  }

  const adminPasswordHash = await bcrypt.hash("ChangeMeNow123!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@mrc.local" },
    update: {
      fullName: "MRC Property Manager",
      status: "ACTIVE",
      unitNumber: "OFFICE",
      passwordHash: adminPasswordHash
    },
    create: {
      email: "admin@mrc.local",
      fullName: "MRC Property Manager",
      status: "ACTIVE",
      unitNumber: "OFFICE",
      passwordHash: adminPasswordHash
    }
  });

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "admin" } });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: admin.id,
        roleId: adminRole.id
      }
    },
    update: {},
    create: {
      userId: admin.id,
      roleId: adminRole.id
    }
  });

  console.log("Seed complete.");
  console.log("Default admin login: admin@mrc.local / ChangeMeNow123!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
