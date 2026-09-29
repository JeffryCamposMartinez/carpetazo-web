-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "firebaseUid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "name" TEXT,
    "fullName" TEXT,
    "username" TEXT,
    "photoURL" TEXT,
    "bannerBase64" TEXT,
    "wallpaperBase64" TEXT,
    "bannerDominantColor" TEXT,
    "bannerComplementaryColor" TEXT,
    "bio" TEXT,
    "phone" TEXT,
    "rut" TEXT,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "youtubeUrl" TEXT,
    "publicTheme" JSONB,
    "addresses" JSONB,
    "bankDetails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Folder" (
    "totalVisits" INTEGER NOT NULL DEFAULT 0,
    "weeklyVisits" INTEGER NOT NULL DEFAULT 0,
    "lastVisitWeek" INTEGER NOT NULL DEFAULT 0,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tcg" TEXT NOT NULL DEFAULT 'Pokemon',
    "color" TEXT NOT NULL DEFAULT 'red',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "tcgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "price" DOUBLE PRECISION,
    "stock" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB,
    "folderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "sellerId" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "folderName" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TcgCategory" (
    "categoryId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "modifiedOn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TcgCategory_pkey" PRIMARY KEY ("categoryId")
);

-- CreateTable
CREATE TABLE "TcgGroup" (
    "blockId" INTEGER,
    "groupId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "publishedOn" TIMESTAMP(3) NOT NULL,
    "modifiedOn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TcgGroup_pkey" PRIMARY KEY ("groupId")
);

-- CreateTable
CREATE TABLE "TcgProduct" (
    "physicalProductId" INTEGER,
    "productId" TEXT NOT NULL,
    "groupId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "cleanName" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "extData" JSONB,

    CONSTRAINT "TcgProduct_pkey" PRIMARY KEY ("productId")
);

-- CreateTable
CREATE TABLE "TcgBlock" (
    "id" SERIAL NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "TcgBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TcgPhysicalProduct" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "releaseDate" TIMESTAMP(3),
    "blockId" INTEGER,

    CONSTRAINT "TcgPhysicalProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Order_code_key" ON "Order"("code");

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TcgGroup" ADD CONSTRAINT "TcgGroup_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "TcgBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TcgGroup" ADD CONSTRAINT "TcgGroup_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TcgCategory"("categoryId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TcgProduct" ADD CONSTRAINT "TcgProduct_physicalProductId_fkey" FOREIGN KEY ("physicalProductId") REFERENCES "TcgPhysicalProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TcgProduct" ADD CONSTRAINT "TcgProduct_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TcgGroup"("groupId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TcgBlock" ADD CONSTRAINT "TcgBlock_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TcgCategory"("categoryId") ON DELETE RESTRICT ON UPDATE CASCADE;

