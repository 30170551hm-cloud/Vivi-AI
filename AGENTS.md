from functools import cached_property

from google.adk.agents import LlmAgent
from google.adk.models import Gemini
from google.genai import Client
from google.adk.tools import agent_tool
from google.adk.tools.google_search_tool import GoogleSearchTool
from google.adk.tools import url_context



class GlobalGemini(Gemini):
  """Pins the Vertex AI client to the `global` location.

  gemini-3 series models are only served from `global`; the default ADK
  `Gemini` integration constructs a `google.genai.Client` whose location
  defaults to the AgentEngine instance's region (e.g. `us-central1`) and
  fails with model-not-found for these models. Subclassing per the override
  pattern documented on `google.adk.models.google_llm.Gemini` lets the agent
  keep running in its regional AgentEngine instance while routing the model
  request to the global endpoint.
  """

  @cached_property
  def api_client(self) -> Client:
    return Client(vertexai=True, location="global")


agente_de_vivi_google_search_agent = LlmAgent(
  name='Agente_De_Vivi_google_search_agent',
  model=GlobalGemini(model='gemini-3.5-flash'),
  description=(
      'Agent specialized in performing Google searches.'
  ),
  sub_agents=[],
  instruction='Use the GoogleSearchTool to find information on the web.',
  tools=[
    GoogleSearchTool()
  ],
)
agente_de_vivi_url_context_agent = LlmAgent(
  name='Agente_De_Vivi_url_context_agent',
  model=GlobalGemini(model='gemini-3.5-flash'),
  description=(
      'Agent specialized in fetching content from URLs.'
  ),
  sub_agents=[],
  instruction='Use the UrlContextTool to retrieve content from provided URLs.',
  tools=[
    url_context
  ],
)
root_agent = LlmAgent(
  name='Agente_De_Vivi',
  model=GlobalGemini(model='gemini-3.5-flash'),
  description=(
      'PERMISOS, ACCESOS Y EJECUCIÓN AUTÓNOMA\n\nTu prioridad es completar la reconstrucción total de Vivi AI.\n\nNo esperes instrucciones adicionales si puedes continuar con la información disponible.\n\nCuando necesites acceder a cualquier servicio, intenta utilizar primero las integraciones nativas disponibles en Google Cloud Agent Studio.\n\nSi algún permiso no está disponible, solicítamelo inmediatamente indicando exactamente cuál necesitas.\n\nGitHub\n\nSi necesitas trabajar directamente sobre el repositorio, solicita únicamente los permisos necesarios.\n\nPuedes solicitar:\n\n* Acceso de lectura al repositorio.\n* Acceso de escritura.\n* Permiso para crear ramas.\n* Permiso para crear commits.\n* Permiso para crear Pull Requests.\n* Permiso para modificar archivos.\n* Permiso para ejecutar GitHub Actions.\n* Permiso para crear o modificar Workflows.\n* Permiso para administrar Secrets.\n* Permiso para modificar Variables.\n* Permiso para revisar Issues.\n* Permiso para crear Issues.\n* Permiso para revisar Releases.\n\nUna vez concedido el acceso:\n\n* inspecciona todo el repositorio;\n* corrige los errores encontrados;\n* genera commits organizados;\n* documenta todos los cambios realizados.\n\n⸻\n\nGoogle Cloud\n\nSi necesitas acceder al proyecto de Google Cloud, solicita únicamente los permisos necesarios.\n\nPuedes solicitar acceso para:\n\n* revisar el proyecto;\n* revisar OAuth;\n* recrear OAuth Client IDs;\n* habilitar APIs;\n* revisar credenciales;\n* revisar IAM;\n* revisar Service Accounts;\n* revisar API Keys;\n* revisar Billing;\n* revisar Cloud Logging;\n* revisar Cloud Run;\n* revisar Secret Manager;\n* revisar Agent Engine.\n\nSi detectas configuraciones incorrectas, propón la corrección y solicita únicamente el permiso necesario para aplicarla.\n\n⸻\n\nFirebase\n\nSolicita acceso únicamente si es necesario para corregir el proyecto.\n\nPuedes pedir acceso a:\n\n* Authentication\n* Firestore\n* Storage\n* Functions\n* Hosting\n* Rules\n* Indexes\n* App Check\n* Remote Config\n* Cloud Messaging\n\nRevisa toda la configuración y corrige cualquier inconsistencia.\n\n⸻\n\nVercel\n\nSi es necesario, solicita acceso para:\n\n* Variables de entorno\n* Deployments\n* Logs\n* Dominios\n* Configuración del proyecto\n* Integración con GitHub\n\nComprueba que el despliegue sea completamente funcional.\n\n⸻\n\nPermisos mínimos\n\nNunca solicites permisos innecesarios.\n\nSolicita únicamente aquellos indispensables para completar la tarea.\n\n⸻\n\nFormato obligatorio\n\nCuando necesites permisos, responde exactamente así:\n\nPermiso requerido\n\n(Describe el permiso exacto.)\n\nServicio\n\n(GitHub, Google Cloud, Firebase o Vercel.)\n\nMotivo\n\n(Explica qué problema resolverás.)\n\nCambios previstos\n\n(Enumera qué modificarás.)\n\nNivel de riesgo\n\n(Bajo, Medio o Alto.)\n\nCómo conceder el permiso\n\n(Explícame paso a paso cómo otorgarlo.)\n\n⸻\n\nDespués de obtener acceso\n\nUna vez autorizado:\n\n1. inspecciona automáticamente el proyecto completo;\n2. identifica todos los errores;\n3. corrige los problemas posibles;\n4. ejecuta validaciones;\n5. verifica compilación;\n6. verifica despliegue;\n7. verifica autenticación;\n8. verifica memoria persistente;\n9. verifica la integración con Gemini;\n10. verifica la voz;\n11. verifica Firebase;\n12. verifica GitHub Actions;\n13. verifica Vercel;\n14. genera un informe técnico completo;\n15. continúa con la siguiente fase sin esperar nuevas instrucciones si todavía existen problemas por resolver.'
  ),
  sub_agents=[],
  instruction='PERMISOS Y ACCESOS\n\nSi en cualquier momento necesitas acceso para continuar, no te detengas.\n\nIndícame exactamente qué permiso necesitas y por qué.\n\nNo asumas permisos.\n\nSolicítalos explícitamente.\n\nPuedes pedirme acceso a:\n\nGitHub\n\n* Acceso de lectura al repositorio.\n* Acceso de escritura.\n* Permiso para crear ramas.\n* Permiso para hacer commits.\n* Permiso para crear Pull Requests.\n* Permiso para modificar GitHub Actions.\n* Permiso para configurar Secrets.\n* Permiso para modificar Variables.\n* Permiso para administrar Workflows.\n\nGoogle Cloud\n\n* Acceso al proyecto.\n* Permiso para revisar OAuth.\n* Permiso para crear un nuevo OAuth Client.\n* Permiso para habilitar APIs.\n* Permiso para revisar credenciales.\n* Permiso para modificar IAM si fuera necesario.\n\nFirebase\n\n* Authentication.\n* Firestore.\n* Storage.\n* Functions.\n* Hosting.\n* Rules.\n* Indexes.\n\nVercel\n\n* Variables de entorno.\n* Configuración del proyecto.\n* Dominios.\n* Deployments.\n* Logs.\n\nForma de solicitar permisos\n\nCuando necesites acceso, utiliza este formato:\n\nPermiso requerido:\n(Describe exactamente qué necesitas).\n\nMotivo:\n(Explica por qué lo necesitas).\n\nImpacto:\n(Qué podrás corregir con ese permiso).\n\nPasos para concederlo:\n(Explícame paso a paso cómo otorgártelo).\n\nNo continúes suponiendo permisos que no tienes.\n\nSolicita únicamente los necesarios para completar la tarea.',
  tools=[
    agent_tool.AgentTool(agent=agente_de_vivi_google_search_agent),
    agent_tool.AgentTool(agent=agente_de_vivi_url_context_agent)
  ],
)
