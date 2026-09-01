# Brewbook API — .NET 10 ASP.NET Core. Multi-stage: SDK to publish, runtime-only image to run.
# Build context is the repo root (see .dockerignore).
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
# Restore first so the package layer is cached until the project file changes.
COPY services/api/src/Brewbook.Api/Brewbook.Api.csproj services/api/src/Brewbook.Api/
RUN dotnet restore services/api/src/Brewbook.Api/Brewbook.Api.csproj
COPY services/api/src/Brewbook.Api services/api/src/Brewbook.Api
RUN dotnet publish services/api/src/Brewbook.Api/Brewbook.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
# Npgsql probes GSSAPI at connect time and logs a load error on every start when the
# library is absent; the runtime image does not ship it.
RUN apt-get update && apt-get install -y --no-install-recommends libgssapi-krb5-2 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV DOTNET_EnableDiagnostics=0 \
    ASPNETCORE_ENVIRONMENT=Production
COPY --from=build /app/publish .
# The aspnet image ships a non-root `app` user (uid 1654).
USER app
EXPOSE 8080
# Railway injects $PORT and Program.cs binds to it (falls back to 8080 for local runs).
ENTRYPOINT ["dotnet", "Brewbook.Api.dll"]
