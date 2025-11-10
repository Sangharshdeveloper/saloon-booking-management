# Use official Node.js image as base
FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies (only production)
RUN npm install --only=production

# Copy rest of the app
COPY . .

# Expose your app port
EXPOSE 3000

# Define environment (optional)
ENV NODE_ENV=production

# Start the app
CMD ["npm", "start"]
