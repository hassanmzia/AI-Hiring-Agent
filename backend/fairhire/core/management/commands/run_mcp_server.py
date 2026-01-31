"""Management command to run the MCP server standalone."""
import uvicorn
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Run the MCP (Model Context Protocol) server"

    def add_arguments(self, parser):
        parser.add_argument("--host", default="0.0.0.0")
        parser.add_argument("--port", type=int, default=8100)

    def handle(self, *args, **options):
        self.stdout.write(f"Starting MCP server on {options['host']}:{options['port']}")
        uvicorn.run(
            "fairhire.wsgi:application",
            host=options["host"],
            port=options["port"],
            log_level="info",
        )
