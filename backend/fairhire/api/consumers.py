"""WebSocket consumers for real-time updates."""

import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer


class PipelineConsumer(AsyncJsonWebsocketConsumer):
    """Real-time pipeline progress for a specific candidate."""

    async def connect(self):
        self.candidate_id = self.scope["url_route"]["kwargs"]["candidate_id"]
        self.group_name = f"pipeline_{self.candidate_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def pipeline_update(self, event):
        await self.send_json(event["data"])


class DashboardConsumer(AsyncJsonWebsocketConsumer):
    """Real-time dashboard updates."""

    async def connect(self):
        await self.channel_layer.group_add("dashboard", self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard("dashboard", self.channel_name)

    async def dashboard_update(self, event):
        await self.send_json(event["data"])
