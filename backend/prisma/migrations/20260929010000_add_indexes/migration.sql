-- CreateIndex
CREATE INDEX "Card_folderId_idx" ON "Card"("folderId");
-- CreateIndex
CREATE INDEX "Card_createdAt_idx" ON "Card"("createdAt");
-- CreateIndex
CREATE INDEX "Card_tcgId_idx" ON "Card"("tcgId");
-- CreateIndex
CREATE INDEX "Folder_userId_idx" ON "Folder"("userId");
-- CreateIndex
CREATE INDEX "Folder_isPublic_createdAt_idx" ON "Folder"("isPublic", "createdAt");
-- CreateIndex
CREATE INDEX "Message_senderId_receiverId_createdAt_idx" ON "Message"("senderId", "receiverId", "createdAt");
-- CreateIndex
CREATE INDEX "Message_receiverId_isRead_idx" ON "Message"("receiverId", "isRead");
-- CreateIndex
CREATE INDEX "Order_sellerId_status_idx" ON "Order"("sellerId", "status");
-- CreateIndex
CREATE INDEX "Order_folderId_idx" ON "Order"("folderId");
-- CreateIndex
CREATE INDEX "TcgGroup_categoryId_idx" ON "TcgGroup"("categoryId");
-- CreateIndex
CREATE INDEX "TcgGroup_blockId_idx" ON "TcgGroup"("blockId");
-- CreateIndex
CREATE INDEX "TcgProduct_groupId_idx" ON "TcgProduct"("groupId");
-- CreateIndex
CREATE INDEX "TcgProduct_categoryId_groupId_idx" ON "TcgProduct"("categoryId", "groupId");
-- CreateIndex
CREATE INDEX "TcgProduct_physicalProductId_idx" ON "TcgProduct"("physicalProductId");
