import "@typespec/http";
import "@typespec/openapi3";

using Http;

@service(#{ title: "Raven" })
@server("https://example.com", "Single server endpoint")
namespace Twitter;

@doc("JWT bearer token authentication")
model BearerAuth {
    type: "http";
    scheme: "bearer";
    bearerFormat: "JWT";
}

