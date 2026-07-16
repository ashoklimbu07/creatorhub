-- AlterTable
ALTER TABLE "users" ADD COLUMN     "connectedPlatforms" "Platform"[] DEFAULT ARRAY[]::"Platform"[];
