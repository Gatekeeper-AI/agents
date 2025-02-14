import os
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from dotenv import load_dotenv

load_dotenv()

class MongoDBClient:
    _instance = None
    _client = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MongoDBClient, cls).__new__(cls)
            # Initialize the MongoDB client
            uri = f"mongodb+srv://zanearidi:{os.getenv('PW')}@db.npj9n.mongodb.net/?retryWrites=true&w=majority&appName=DB"
            cls._client = MongoClient(uri, server_api=ServerApi('1'))
            
            # Test the connection
            try:
                cls._client.admin.command('ping')
                print("Pinged your deployment. You successfully connected to MongoDB!")
            except Exception as e:
                print(f"MongoDB connection error: {e}")
                
        return cls._instance

    @property
    def client(self):
        return self._client

    def get_database(self, db_name: str):
        return self._client[db_name]

# Create a global instance
mongodb = MongoDBClient()