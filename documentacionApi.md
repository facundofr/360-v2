---
openapi: 3.0.3
info:
  title: VaFirma API
  version: 1.5.0
tags:
- name: Biometrics Integration API V1
- name: External Signatures API V1
- name: Notificacion API V1
- name: Stats API V1
paths:
  /v1/biometrics:
    post:
      tags:
      - Biometrics Integration API V1
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BiometricRequest'
      responses:
        "200":
          description: Consumo satisfactorio.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BiometricResponse'
        "400":
          description: Solicitud con sintaxis incorrecta.
        "404":
          description: Objeto no encontrado.
        "409":
          description: Objeto duplicado (originId).
        "500":
          description: Error interno del servidor.
        "401":
          description: Not Authorized
        "403":
          description: Not Allowed
      security:
      - SecurityScheme:
        - AUTH
  /v1/biometrics/images/{bioUUID}:
    post:
      tags:
      - Biometrics Integration API V1
      parameters:
      - name: bioUUID
        in: path
        required: true
        schema:
          type: string
      responses:
        "200":
          description: Consumo satisfactorio.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BiometricRequest'
        "400":
          description: Solicitud con sintaxis incorrecta.
        "404":
          description: Objeto no encontrado.
        "500":
          description: Error interno del servidor.
        "401":
          description: Not Authorized
        "403":
          description: Not Allowed
      security:
      - SecurityScheme:
        - AUTH
  /v1/biometrics/me/buscar:
    get:
      tags:
      - Biometrics Integration API V1
      parameters:
      - name: "ascending[]"
        in: query
        schema:
          type: array
          items:
            type: boolean
      - name: bioPk
        in: query
        schema:
          format: int64
          type: integer
      - name: bioStatus
        in: query
        schema:
          type: object
      - name: bioStatuses
        in: query
        schema:
          type: array
          items: {}
      - name: bioUUID
        in: query
        schema:
          type: string
      - name: bioUserEmail
        in: query
        schema:
          type: string
      - name: bioUsuPk
        in: query
        schema:
          format: int64
          type: integer
      - name: bioUsuValidationPk
        in: query
        schema:
          format: int64
          type: integer
      - name: endDate
        in: query
        schema:
          $ref: '#/components/schemas/LocalDate'
      - name: first
        in: query
        schema:
          format: int64
          type: integer
      - name: "incluirCampos[]"
        in: query
        schema:
          type: array
          items:
            type: string
      - name: maxResults
        in: query
        schema:
          format: int64
          type: integer
      - name: "orderBy[]"
        in: query
        schema:
          type: array
          items:
            type: string
      - name: originId
        in: query
        schema:
          type: string
      - name: startDate
        in: query
        schema:
          $ref: '#/components/schemas/LocalDate'
      responses:
        "200":
          description: Consumo satisfactorio.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BiometricRequest'
        "400":
          description: Solicitud con sintaxis incorrecta.
        "404":
          description: Objeto no encontrado.
        "500":
          description: Error interno del servidor.
        "401":
          description: Not Authorized
        "403":
          description: Not Allowed
      security:
      - SecurityScheme:
        - AUTH
  /v1/biometrics/me/buscar/total:
    get:
      tags:
      - Biometrics Integration API V1
      parameters:
      - name: "ascending[]"
        in: query
        schema:
          type: array
          items:
            type: boolean
      - name: bioPk
        in: query
        schema:
          format: int64
          type: integer
      - name: bioStatus
        in: query
        schema:
          type: object
      - name: bioStatuses
        in: query
        schema:
          type: array
          items: {}
      - name: bioUUID
        in: query
        schema:
          type: string
      - name: bioUserEmail
        in: query
        schema:
          type: string
      - name: bioUsuPk
        in: query
        schema:
          format: int64
          type: integer
      - name: bioUsuValidationPk
        in: query
        schema:
          format: int64
          type: integer
      - name: endDate
        in: query
        schema:
          $ref: '#/components/schemas/LocalDate'
      - name: first
        in: query
        schema:
          format: int64
          type: integer
      - name: "incluirCampos[]"
        in: query
        schema:
          type: array
          items:
            type: string
      - name: maxResults
        in: query
        schema:
          format: int64
          type: integer
      - name: "orderBy[]"
        in: query
        schema:
          type: array
          items:
            type: string
      - name: originId
        in: query
        schema:
          type: string
      - name: startDate
        in: query
        schema:
          $ref: '#/components/schemas/LocalDate'
      responses:
        "200":
          description: Consumo satisfactorio.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BiometricRequest'
        "400":
          description: Solicitud con sintaxis incorrecta.
        "404":
          description: Objeto no encontrado.
        "500":
          description: Error interno del servidor.
        "401":
          description: Not Authorized
        "403":
          description: Not Allowed
      security:
      - SecurityScheme:
        - AUTH
  /v1/biometrics/me/evidence/{bioUUID}:
    get:
      tags:
      - Biometrics Integration API V1
      parameters:
      - name: bioUUID
        in: path
        required: true
        schema:
          type: string
      responses:
        "200":
          description: Consumo satisfactorio.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BiometricRequest'
        "400":
          description: Solicitud con sintaxis incorrecta.
        "404":
          description: Objeto no encontrado.
        "500":
          description: Error interno del servidor.
        "401":
          description: Not Authorized
        "403":
          description: Not Allowed
      security:
      - SecurityScheme:
        - AUTH
  /v1/biometrics/notify/{bioUUID}:
    post:
      tags:
      - Biometrics Integration API V1
      parameters:
      - name: bioUUID
        in: path
        required: true
        schema:
          type: string
      responses:
        "200":
          description: Consumo satisfactorio.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BiometricRequest'
        "400":
          description: Solicitud con sintaxis incorrecta.
        "404":
          description: Objeto no encontrado.
        "500":
          description: Error interno del servidor.
        "401":
          description: Not Authorized
        "403":
          description: Not Allowed
      security:
      - SecurityScheme:
        - AUTH
  /v1/biometrics/updateby/{bioUUID}:
    post:
      tags:
      - Biometrics Integration API V1
      parameters:
      - name: bioUUID
        in: path
        required: true
        schema:
          type: string
      requestBody:
        content:
          application/json:
            schema:
              type: array
      responses:
        "200":
          description: Consumo satisfactorio.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BiometricRequest'
        "400":
          description: Solicitud con sintaxis incorrecta.
        "404":
          description: Objeto no encontrado.
        "500":
          description: Error interno del servidor.
        "401":
          description: Not Authorized
        "403":
          description: Not Allowed
      security:
      - SecurityScheme:
        - AUTH
  /v1/biometrics/{bioUUID}:
    get:
      tags:
      - Biometrics Integration API V1
      parameters:
      - name: bioUUID
        in: path
        required: true
        schema:
          type: string
      responses:
        "200":
          description: Consumo satisfactorio.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BiometricRequestProcess'
        "400":
          description: Solicitud con sintaxis incorrecta.
        "404":
          description: Objeto no encontrado.
        "500":
          description: Error interno del servidor.
        "401":
          description: Not Authorized
        "403":
          description: Not Allowed
      security:
      - SecurityScheme:
        - AUTH
  /v1/biometrics/{provider}/{bioUUID}/face/login:
    post:
      tags:
      - Biometrics Integration API V1
      parameters:
      - name: bioUUID
        in: path
        required: true
        schema:
          type: string
      - name: provider
        in: path
        required: true
        schema:
          type: string
      requestBody:
        content:
          application/json:
            schema:
              type: array
      responses:
        "200":
          description: OK
        "401":
          description: Not Authorized
        "403":
          description: Not Allowed
      security:
      - SecurityScheme:
        - AUTH
  /v1/biometrics/{provider}/{bioUUID}/onboarding/addBack:
    post:
      tags:
      - Biometrics Integration API V1
      parameters:
      - name: bioUUID
        in: path
        required: true
        schema:
          type: string
      - name: provider
        in: path
        required: true
        schema:
          type: string
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BiometricAddBackOperation'
      responses:
        "200":
          description: Consumo satisfactorio.
        "400":
          description: Solicitud con sintaxis incorrecta.
        "404":
          description: Objeto no encontrado.
        "500":
          description: Error interno del servidor.
        "401":
          description: Not Authorized
        "403":
          description: Not Allowed
      security:
      - SecurityScheme:
        - AUTH
  /v1/biometrics/{provider}/{bioUUID}/onboarding/addFront:
    post:
      tags:
      - Biometrics Integration API V1
      parameters:
      - name: bioUUID
        in: path
        required: true
        schema:
          type: string
      - name: provider
        in: path
        required: true
        schema:
          type: string
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BiometricAddFrontOperation'
      responses:
        "200":
          description: Consumo satisfactorio.
        "400":
          description: Solicitud con sintaxis incorrecta.
        "404":
          description: Objeto no encontrado.
        "500":
          description: Error interno del servidor.
        "401":
          description: Not Authorized
        "403":
          description: Not Allowed
      security:
      - SecurityScheme:
        - AUTH
  /v1/biometrics/{provider}/{bioUUID}/onboarding/endOperation:
    post:
      tags:
      - Biometrics Integration API V1
      parameters:
      - name: bioUUID
        in: path
        required: true
        schema:
          type: string
      - name: provider
        in: path
        required: true
        schema:
          type: string
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BiometricEndOperation'
      responses:
        "200":
          description: Consumo satisfactorio.
        "400":
          description: Solicitud con sintaxis incorrecta.
        "404":
          description: Objeto no encontrado.
        "500":
          description: Error interno del servidor.
        "401":
          description: Not Authorized
        "403":
          description: Not Allowed
      security:
      - SecurityScheme:
        - AUTH
  /v1/biometrics/{provider}/{bioUUID}/onboarding/newOperation:
    post:
      tags:
      - Biometrics Integration API V1
      parameters:
      - name: bioUUID
        in: path
        required: true
        schema:
          type: string
      - name: provider
        in: path
        required: true
        schema:
          type: string
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BiometricNewOperation'
      responses:
        "200":
          description: Consumo satisfactorio.
        "400":
          description: Solicitud con sintaxis incorrecta.
        "404":
          description: Objeto no encontrado.
        "500":
          description: Error interno del servidor.
        "401":
          description: Not Authorized
        "403":
          description: Not Allowed
      security:
      - SecurityScheme:
        - AUTH
  /v1/biometrics/{provider}/{bioUUID}/onboarding/register:
    post:
      tags:
      - Biometrics Integration API V1
      parameters:
      - name: bioUUID
        in: path
        required: true
        schema:
          type: string
      - name: provider
        in: path
        required: true
        schema:
          type: string
      requestBody:
        content:
          application/json:
            schema:
              type: array
      responses:
        "200":
          description: OK
        "401":
          description: Not Authorized
        "403":
          description: Not Allowed
      security:
      - SecurityScheme:
        - AUTH
  /v1/biometrics/{provider}/{docUUID}/face/register:
    post:
      tags:
      - Biometrics Integration API V1
      parameters:
      - name: docUUID
        in: path
        required: true
        schema:
          type: string
      - name: provider
        in: path
        required: true
        schema:
          type: string
      requestBody:
        content:
          application/json:
            schema:
              type: array
      responses:
        "200":
          description: OK
        "401":
          description: Not Authorized
        "403":
          description: Not Allowed
      security:
      - SecurityScheme:
        - AUTH
  /v1/ext/signatures/me/download:
    get:
      tags:
      - External Signatures API V1
      summary: "Returns byte [] with file content. User must be the creator of the\
        \ document"
      parameters:
      - name: docOriginId
        in: query
        schema:
          type: string
      - name: docUUID
        in: query
        schema:
          type: string
      responses:
        "200":
          description: Successful.
        "400":
          description: Request with incorrect syntax.
        "404":
          description: Not found.
        "500":
          description: Internal server error.
      security:
      - jwt: []
  /v1/ext/signatures/me/status:
    get:
      tags:
      - External Signatures API V1
      summary: Returns the status of the document. User must be the creator of the
        document
      parameters:
      - name: docOriginId
        in: query
        schema:
          type: string
      - name: docUUID
        in: query
        schema:
          type: string
      responses:
        "200":
          description: Successful.
          content:
            application/json:
              schema:
                enum:
                - SIGNED
                - PENDING
                type: string
        "400":
          description: Request with incorrect syntax.
        "404":
          description: Not found.
        "500":
          description: Internal server error.
      security:
      - jwt: []
  /v1/ext/signatures/me/{docUUID}:
    delete:
      tags:
      - External Signatures API V1
      summary: Delete document. User must be the creator of the document
      parameters:
      - name: docUUID
        in: path
        required: true
        schema:
          type: string
      - name: docOriginId
        in: query
        schema:
          type: string
      responses:
        "200":
          description: Successful delete.
        "400":
          description: Request with incorrect syntax.
        "404":
          description: Not found.
        "500":
          description: Internal server error.
        "401":
          description: Not Authorized
        "403":
          description: Not Allowed
      security:
      - SecurityScheme:
        - ELIMINAR_DOCUMENTOS_FIRMA
  /v1/ext/signatures/me/{docUUID}/recipient:
    post:
      tags:
      - External Signatures API V1
      summary: Actializa el objeto con la id indicada.
      parameters:
      - name: docUUID
        in: path
        required: true
        schema:
          type: string
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Recipient'
      responses:
        "200":
          description: Archivado satisfactorio.
        "400":
          description: Solicitud con sintaxis incorrecta.
        "404":
          description: Objeto no encontrado.
        "422":
          description: Entidad referenciada. Datos incorrectos.
        "500":
          description: Error interno del servidor.
        "401":
          description: Not Authorized
        "403":
          description: Not Allowed
      security:
      - SecurityScheme:
        - ACTUALIZAR_DOCUMENTOS_FIRMA
  /v1/ext/signatures/request:
    post:
      tags:
      - External Signatures API V1
      summary: Create an external signature request.
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SignatureRequest'
      responses:
        "201":
          description: Entity created successfully.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SignatureCreatedResponse'
        "400":
          description: Request with incorrect syntax.
        "422":
          description: Entity cannot be processed. Incorrect data.
        "500":
          description: Internal server error.
      deprecated: true
      security:
      - jwt: []
  /v1/ext/signatures/requestmultiple:
    post:
      tags:
      - External Signatures API V1
      summary: Create an external signature request multiple documents.
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SignatureRequestMultiple'
      responses:
        "201":
          description: Entity created successfully.
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/SignatureCreatedResponse'
        "400":
          description: Request with incorrect syntax.
        "422":
          description: Entity cannot be processed. Incorrect data.
        "500":
          description: Internal server error.
      security:
      - jwt: []
  /v1/ext/signatures/search:
    get:
      tags:
      - External Signatures API V1
      summary: Devuelve los documentos creados por el usuario que satisfacen el criterio.
      parameters:
      - name: appprovalDocumentsOnly
        in: query
        schema:
          type: boolean
      - name: completeDocumentsOnly
        in: query
        schema:
          type: boolean
      - name: endDate
        in: query
        schema:
          $ref: '#/components/schemas/LocalDate'
      - name: first
        in: query
        schema:
          format: int64
          type: integer
      - name: pendingApprovalDocumentsOnly
        in: query
        schema:
          type: boolean
      - name: pendingDocumentsOnly
        in: query
        schema:
          type: boolean
      - name: startDate
        in: query
        schema:
          $ref: '#/components/schemas/LocalDate'
      responses:
        "200":
          description: Consumo satisfactorio.
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/DocumentStatus'
        "400":
          description: Solicitud con sintaxis incorrecta.
        "500":
          description: Error interno del servidor.
        "401":
          description: Not Authorized
        "403":
          description: Not Allowed
      security:
      - SecurityScheme:
        - BUSCAR_DOCUMENTOS_FIRMA
  /v1/notificacion/me/cancel:
    post:
      tags:
      - Notificacion API V1
      summary: Cancelar notifica recurrente del usuario.
      responses:
        "200":
          description: Consumo satisfactorio.
        "400":
          description: Solicitud con sintaxis incorrecta.
        "500":
          description: Error interno del servidor.
        "401":
          description: Not Authorized
        "403":
          description: Not Allowed
      security:
      - SecurityScheme:
        - AUTH
  /v1/notificacion/next/{docUUID}:
    post:
      tags:
      - Notificacion API V1
      summary: Notifica usuario que tiene que firmar.
      parameters:
      - name: docUUID
        in: path
        required: true
        schema:
          type: string
      - name: withLink
        in: query
        schema:
          type: boolean
      responses:
        "200":
          description: Consumo satisfactorio.
        "400":
          description: Solicitud con sintaxis incorrecta.
        "500":
          description: Error interno del servidor.
        "401":
          description: Not Authorized
        "403":
          description: Not Allowed
      security:
      - SecurityScheme:
        - BUSCAR_DOCUMENTOS_FIRMA
  /v1/stats/search/counters:
    get:
      tags:
      - Stats API V1
      summary: Devuelve stats.
      parameters:
      - name: dayEnd
        in: query
        description: Day to Filter
        schema:
          maximum: 31
          minimum: 1
          type: integer
      - name: dayStart
        in: query
        description: Day to Filter
        schema:
          maximum: 31
          minimum: 1
          type: integer
      - name: monthEnd
        in: query
        description: Month to Filter
        schema:
          maximum: 12
          minimum: 1
          type: integer
      - name: monthStart
        in: query
        description: Month to Filter
        schema:
          maximum: 12
          minimum: 1
          type: integer
      - name: name
        in: query
        description: Counter name to Filter
        schema:
          type: string
      - name: orgPk
        in: query
        schema:
          format: int64
          description: Organization to Filter
          type: integer
      - name: yearEnd
        in: query
        description: Year to Filter
        schema:
          minimum: 1900
          type: integer
      - name: yearStart
        in: query
        description: Year to Filter
        schema:
          minimum: 1900
          type: integer
      responses:
        "200":
          description: Consumo satisfactorio.
          content:
            application/json:
              schema:
                type: object
        "400":
          description: Solicitud con sintaxis incorrecta.
        "404":
          description: Objeto no encontrado.
        "500":
          description: Error interno del servidor.
        "401":
          description: Not Authorized
        "403":
          description: Not Allowed
      security:
      - SecurityScheme:
        - AUTH
        - CREAR_SOLICITUD_FIRMA
components:
  schemas:
    AdditionalData:
      description: Datos adicionales del documento
      type: object
      properties:
        expiryDate:
          type: string
        address:
          type: string
        detectedCountry:
          type: string
        issueDate:
          type: string
        tramitNumber:
          type: string
        nationality:
          type: string
    Approver:
      required:
      - approverName
      - approverEmail
      type: object
      properties:
        approverName:
          description: Approver name
          type: string
        approverEmail:
          description: Approver email
          type: string
    AuthAppRequest:
      description: Auth app request
      type: object
      properties:
        apiKey:
          type: string
    Barcode:
      description: Barcode data from document recognition
      type: object
      properties:
        contains:
          type: boolean
        readed:
          type: boolean
        data:
          $ref: '#/components/schemas/BarcodeData'
    BarcodeData:
      description: Parsed data from barcode
      type: object
      properties:
        number:
          type: string
        names:
          type: string
        gender:
          type: string
        prefixSuffixCuil:
          type: string
        lastNames:
          type: string
        copy:
          type: string
        issueDate:
          type: string
        birthDate:
          type: string
        order:
          type: string
    BiometricAddBackOperation:
      description: Biometric Add Back Operation
      required:
      - userName
      - operationId
      - analyzeAnomalies
      - analyzeOcr
      - file
      type: object
      properties:
        userName:
          description: Identifier of the user of the operation
          type: string
        operationId:
          format: int64
          description: Id of the created operation
          type: integer
        operationGuid:
          description: (guid/required) if enabled in context.xml enableOperationGuid)
            unique identifier of the operation.
          type: string
        analyzeAnomalies:
          description: Must be true to validate the veracity of the physical document
          type: boolean
        analyzeOcr:
          description: Must be set to true to get the OCR information for the front
            and back of the document
          type: boolean
        file:
          description: "Image of the front of the document, in base64. Specifications\
            \ for the image to be sent: { Format: JPG, Minimum width: 1000 px, Maximum\
            \ width: 2000 px, Recommended width: 1200 px }"
          type: string
    BiometricAddFrontOperation:
      description: Biometric Add Front Operation
      required:
      - userName
      - operationId
      - analyzeAnomalies
      - analyzeOcr
      - file
      type: object
      properties:
        userName:
          description: Identifier of the user of the operation
          type: string
        operationId:
          format: int64
          description: Id of the created operation
          type: integer
        operationGuid:
          description: (guid/required) if enabled in context.xml enableOperationGuid)
            unique identifier of the operation.
          type: string
        analyzeAnomalies:
          description: Must be true to validate the veracity of the physical document
          type: boolean
        analyzeOcr:
          description: Must be set to true to get the OCR information for the front
            and back of the document
          type: boolean
        file:
          description: "Image of the front of the document, in base64. Specifications\
            \ for the image to be sent: { Format: JPG, Minimum width: 1000 px, Maximum\
            \ width: 2000 px, Recommended width: 1200 px }"
          type: string
    BiometricEndOperation:
      description: Biometric End Operation
      required:
      - userName
      - operationId
      type: object
      properties:
        userName:
          description: Identifier of the user of the operation
          type: string
        operationId:
          format: int64
          description: Id of the created operation
          type: integer
        operationGuid:
          description: (guid/required) if enabled in context.xml enableOperationGuid)
            unique identifier of the operation.
          type: string
        idRawResponse:
          description: " enter true if you want to include the data obtained from\
            \ the ID analysis and the comparisons between both sides. If you do not\
            \ enter anything, it will be false"
          type: boolean
    BiometricNewOperation:
      description: Biometric New Operation
      required:
      - userName
      type: object
      properties:
        userName:
          description: Identifier of the user of the operation
          type: string
        ipAddress:
          description: IP of the device being used to carry out the operation
          type: string
        deviceHash:
          description: Unique identifier of the device that is being used to perform
            the operation. This data is left to the service customer's choice
          type: string
        rooted:
          description: Sets whether the device is rooted or not
          type: string
        applicationVersion:
          description: Version of the application
          type: string
        operatingSystem:
          description: Operating system.
          type: string
        operativeSystemVersion:
          description: version of the device's operating system
          type: string
        deviceManufacturer:
          description: Device manufacturer
          type: string
        deviceName:
          description: Device name
          type: string
        dataAgreement:
          description: Identifier of acceptance of consent by the user
          type: string
    BiometricNewOperationResponse:
      description: Biometric New Operation Response
      required:
      - userName
      type: object
      properties:
        userName:
          description: Identifier of the user of the operation
          type: string
        code:
          format: int64
          description: Response code
          type: integer
        message:
          description: Description of the response
          type: string
        operationId:
          format: int64
          description: Id of the created operation
          type: integer
        operationGuid:
          description: (guid/required) if enabled in context.xml enableOperationGuid)
            unique identifier of the operation
          type: string
    BiometricRequest:
      description: Biometric request
      required:
      - personName
      - personEmail
      - validationType
      type: object
      properties:
        emailMessage:
          description: Additional body of email sent to Person
          type: string
          example: Biometric Request Message
        emailSubject:
          description: Subject of email sent to Person
          type: string
          example: Biometric Request
        originId:
          description: Unique ID of the biometric request in the origin application.
            This ID cannot be the same for different biometric requests.
          type: string
        personName:
          description: Person´s name
          type: string
        personEmail:
          description: Person´s email
          type: string
        personPhoneNumber:
          description: Person´s phone number
          type: string
        redirectUrl:
          description: Redirect url for the recipient after his validatioon is done
          type: string
        callbackUrl:
          description: POST callback url invoked by VaFirma after validation is complete.
            VaFirma bioUUID and originId (if present) will be sent in body.
          type: string
        useGestures:
          description: Use gestures to validate person is alive
          type: boolean
        validationType:
          description: Type of biometrcis
          type: object
          example: FACE|FIRNGER|IRIS
        ttlToken:
          format: int32
          description: Time to live in minutes for token
          default: 1440
          type: integer
        retries:
          format: int32
          description: Number of retries
          default: 3
          type: integer
        documentValidation:
          description: Document number to validate
          type: string
        notify:
          description: Notify request
          type: boolean
    BiometricRequestProcess:
      description: Biometric Request Process
      type: object
      properties:
        bioUUID:
          type: string
        bioCreatedDate:
          format: date-time
          type: string
          example: 2022-03-10T12:15:50
        bioTipo:
          type: object
        bioStatus:
          type: object
        bioRedirectUrl:
          type: string
        bioUseGestures:
          type: boolean
        bioProvider:
          type: object
        bioUser:
          type: string
        bioRetries:
          format: int32
          type: integer
        bioTries:
          format: int32
          type: integer
    BiometricResponse:
      description: Biometric response
      type: object
      properties:
        bioUUID:
          description: Unique id of the request
          type: string
          example: ff1a0430-6128-4e91-a668-3cef533f28b4
        link:
          description: Link for validation process
          type: string
    CertificateDTO:
      description: Información de un certificado
      type: object
      properties:
        status:
          description: Estado del certificado
          type: string
          example: VALID
        serial_number:
          description: Número de serie del certificado
          type: string
          example: 03243d63df48a72d
        valid_from:
          description: Fecha de inicio de validez
          type: string
          example: 20251002 13:11:00
        valid_to:
          description: Fecha de expiración
          type: string
          example: 20251003 13:11:00
    CreateVideoId:
      required:
      - onboardingType
      type: object
      properties:
        onboardingType:
          type: string
        documentType:
          type: string
        issuanceCountry:
          type: string
        documentNumber:
          type: string
        firstName:
          type: string
        secondName:
          type: string
        firstSurname:
          type: string
        secondSurname:
          type: string
        birthDate:
          type: string
        phoneNumber:
          type: string
        email:
          type: string
        additionalInfo:
          type: array
    DataForm:
      required:
      - tag
      - value
      type: object
      properties:
        tag:
          description: Tag name
          type: string
        value:
          description: Value
          type: string
    DocumentStatus:
      type: object
      properties:
        docUUID:
          description: Document UUID
          type: string
          example: 46d3d6bc-2ec2-4e02-ab32-9d56d6ddc5c8
        docOriginId:
          description: Origin Id
          type: string
          example: id cliente
        docEstado:
          description: Docuement Status
          type: string
          example: SIGNED
    DocumentoDigitalizado:
      description: Datos del Documento Digitalizado
      type: object
      properties:
        persona:
          description: Datos de la persona
          type: object
          allOf:
          - $ref: '#/components/schemas/Persona'
        idSolicitud:
          format: int32
          description: Copia del número de solicitud recibido
          type: integer
        IdRespuesta:
          format: int32
          description: Autogenerado relativo a la respuesta
          type: integer
        imagenes:
          description: |
            Array dinámico de imágenes conteniendo frente (de existir la imagen) y dorso (de existir la imagen)
          type: array
          items:
            $ref: '#/components/schemas/ImagenDigital'
        warnings:
          description: Array dinámico de Advertencias (ver códigos de error detallados
            en sección 2.3 (DNIC) con severidad WRN)
          type: array
          items:
            $ref: '#/components/schemas/Mensaje'
        errors:
          description: Array dinámico de Errores (ver códigos detallados en sección
            2.3 (DNIC) con severidad ERR)
          type: array
          items:
            $ref: '#/components/schemas/Mensaje'
        idRespuesta:
          format: int32
          type: integer
    EndOperationResponse:
      description: End operation response
      required:
      - mrz
      - ocr
      - barcode
      type: object
      properties:
        mrz:
          description: MRZ
          type: object
          allOf:
          - $ref: '#/components/schemas/EndOperationResponseMrz'
        ocr:
          description: OCR
          type: object
          allOf:
          - $ref: '#/components/schemas/Ocr'
        barcode:
          description: BARCODE
          type: object
          allOf:
          - $ref: '#/components/schemas/Barcode'
        operationGuid:
          description: operationGuid
          type: string
        operationId:
          description: operationId
          type: string
        documentExipired:
          type: boolean
    EndOperationResponseMrz:
      description: End operation response
      type: object
      properties:
        contains:
          type: boolean
        readed:
          type: boolean
        data:
          $ref: '#/components/schemas/EndOperationResponseMrzData'
    EndOperationResponseMrzData:
      description: End operation response
      type: object
      properties:
        expiryDate:
          type: string
        countryIso:
          type: string
        lastNames:
          type: string
        mrzType:
          type: string
        gender:
          type: string
        number:
          type: string
        nationality:
          type: string
        names:
          type: string
        type:
          type: string
        nationalityIso:
          type: string
        fullName:
          type: string
        country:
          type: string
        birthDate:
          type: string
    FormCustomTag:
      required:
      - overlayType
      - name
      - text
      - bbox
      - pageIndex
      type: object
      properties:
        overlayType:
          description: Fixed to 'custom-label'
          type: string
        name:
          description: Name of the field
          type: string
        text:
          description: Text to be inserted in pdf
          type: string
        bbox:
          description: |-
            Coordinates array (x, y, W, H):
            x – the X coordinate of the upper-left corner of the box
            y – the Y coordinate of the upper-left corner of the box
            w – the width of the box
            h – the height of the box
          type: array
          items:
            format: float
            type: number
        pageIndex:
          format: int32
          description: Page Index
          type: integer
        fontSize:
          format: int32
          description: Font Size
          default: 20
          type: integer
        fontFamily:
          description: Font Family
          default: "Helvetica, Sans-Serif"
          type: string
        fontColor:
          description: Font Color
          default: black
          type: string
    ImagenDigital:
      description: Imagen de la persona del Documento Digitalizado
      type: object
      properties:
        foto:
          description: 'Imagen '
          type: string
        largoBytes:
          format: int32
          type: integer
        tipoImagen:
          format: int32
          type: integer
    LocalDate:
      format: date
      type: string
      example: 2022-03-10
    Mensaje:
      type: object
      properties:
        codigo:
          format: int32
          type: integer
        descripcion:
          type: string
        datoExtra:
          type: string
    Ocr:
      description: OCR data from document recognition
      type: object
      properties:
        lastNames:
          type: string
        gender:
          type: string
        birthdate:
          type: string
        names:
          type: string
        number:
          type: string
        extra:
          $ref: '#/components/schemas/OcrExtra'
    OcrExtra:
      description: Additional
      type: object
      properties:
        additional:
          type: string
        mrz:
          type: string
    Persona:
      description: Datos de la persona
      type: object
      properties:
        codTipoDocumento:
          description: "Tipo de documento (default: DO)"
          type: string
        primerApellido:
          description: Primer Apellido de la persona
          type: string
        segundoApellido:
          description: Segundo Apellido de la persona
          type: string
        primerNombre:
          description: Primer Nombre de la persona
          type: string
        segundoNombre:
          description: Segundo Nombre de la persona
          type: string
        sexo:
          format: int32
          description: "Sexo de la persona (1=masculino, 2= femenino)"
          type: integer
        codNacionalidad:
          format: int32
          description: Identificador de la nacionalidad. 1=Oriental / 3=Extranjero
            / 0=Desconocida
          type: integer
        nombreEnCedula:
          description: "Nombre que aparece en la CI (puede diferir de los datos de\
            \ nombres y apellidos en caso de nombres acreditados por juez, o inversió\
            n de apellidos para extranjeros)"
          type: string
        fechaNacimiento:
          description: Fecha de nacimiento en formato yyyy-MM-dd pudiendo ser parcial
            (yyyy) o vacía.
          type: string
        apellidoAdoptivo1:
          description: Apellido materno adoptivo de la persona
          type: string
        apellidoAdoptivo2:
          description: Apellido paterno adoptivo de la persona
          type: string
        nroDocumento:
          description: Número de Documento
          type: string
    Recipient:
      required:
      - signerName
      - signerEmail
      type: object
      properties:
        signerEmailOriginal:
          description: Signer email original
          type: string
        signerName:
          description: Signer name
          type: string
        signerEmail:
          description: Signer email
          type: string
        signerPhoneNumber:
          description: Signer phone number
          type: string
        signerParticipantType:
          description: Signer Participant Type
          enum:
          - FIRMANTED
          - RECIBE_COPIA
          - APROBACION
          type: object
        redirectUrl:
          description: Redirect url for the recipient after his signature is done
          type: string
        signaturePageIndex:
          format: int32
          description: Page index of the signature. First page index is 0
          type: integer
        signaturePageX:
          format: float
          description: X coordinate of the signature (Points unit)
          type: number
        signaturePageY:
          format: float
          description: Y coordinate of the signature (Points unit)
          type: number
        signatureWidth:
          format: float
          description: Width of the signature (Points unit)
          default: 225
          type: number
        signatureHeight:
          format: float
          description: Height box of the signature (Points unit)
          default: 30
          type: number
        signatureTagName:
          description: The name of the tag to apply the signature to
          type: string
        signerParticipantIndex:
          format: int32
          description: Signer Participant Index
          type: integer
        signerLanguage:
          description: Signer Language
          type: string
        form:
          description: Form to ask the user to complete
          type: array
          items:
            $ref: '#/components/schemas/FormCustomTag'
        signerDocument:
          description: Signer Document number
          type: string
    RequestedSignatureAttachment:
      required:
      - description
      - required
      type: object
      properties:
        description:
          description: File description
          type: string
        required:
          description: True if the file is required and false if it is optional
          type: boolean
    SgPrepareLateSignature:
      description: Prepare Late Signature
      required:
      - hexCertificate
      - imageSignature
      type: object
      properties:
        hexCertificate:
          description: Hex Certificate
          type: string
        imageSignature:
          description: Image Signature
          type: string
        useBase64:
          description: Type File
          type: boolean
    SgPreparePfxSignature:
      description: Prepare Pfx Signature
      required:
      - fileContent
      type: object
      properties:
        fileContent:
          description: Certificate
          type: string
        imageSignature:
          description: Image Signature
          type: string
        pin:
          description: Pin
          type: string
    SgPrepareResponseXades:
      description: Prepare Late Signature Xades configuration response
      required:
      - operationId
      - toBeSignedBase64
      - digestAlgorithm
      - signatureAlgorithm
      - parametersJsonBase64
      - docHashBase64
      type: object
      properties:
        operationId:
          description: operationId
          type: string
        toBeSignedBase64:
          description: toBeSignedBase64
          type: string
        digestAlgorithm:
          description: digestAlgorithm
          type: object
        signatureAlgorithm:
          description: signatureAlgorithm
          type: object
        parametersJsonBase64:
          description: parametersJsonBase64
          type: string
        docHashBase64:
          description: docHashBase64
          type: string
    SgTagApp:
      required:
      - name
      - value
      type: object
      properties:
        name:
          description: Tag Name
          type: string
          example: ID
        value:
          description: Tag Value
          type: string
          example: "123456"
    SgUploadFile64:
      required:
      - content
      - name
      - content-type
      type: object
      properties:
        content:
          description: document´s content in base64
          type: string
        name:
          description: Name of the document
          type: string
        content-type:
          description: Header content-type
          type: string
    SignatureCreatedResponse:
      type: object
      properties:
        docUUID:
          type: string
        link:
          type: string
        signerEmail:
          type: string
    SignatureRequest:
      description: Signature request
      required:
      - emailSubject
      - fileUUID
      - fileName
      - signatureType
      - recipients
      type: object
      properties:
        emailMessage:
          description: Additional body of email sent to recipients.
          type: string
        emailSubject:
          description: Subject of email sent to recipients
          type: string
          example: Signature Request
        solDiasNotificacion:
          format: int32
          description: Pending days to notify
          type: integer
          example: 5
        fileUUID:
          description: UUID of the uploaded PDF to /v1/files/tmp/upload
          type: string
          example: 46d3d6bc-2ec2-4e02-ab32-9d56d6ddc5c8
        docOriginId:
          description: Unique ID of the signature request for the document in the
            origin application. This ID cannot be the same for different signature
            requests.
          type: string
          deprecated: true
        fileName:
          description: Name of the file with extension
          type: string
          example: Document.pdf
        signatureType:
          description: Signature type
          enum:
          - Advanced
          - Simple
          type: string
          example: Simple
        signatureSubType:
          description: Signature sub type
          enum:
          - Simple
          - Biometric
          - Advanced
          type: string
          example: Biometric
        callbackUrl:
          description: POST callback url invoked by VaFirma after all recipients signing
            is complete. VaFirma docUUID and docOriginId (if present) will be sent
            in body.
          maxLength: 1024
          type: string
        recipients:
          description: List of recipients
          type: array
          items:
            $ref: '#/components/schemas/Recipient'
        approvers:
          description: List of approvers
          type: array
          items:
            $ref: '#/components/schemas/Approver'
        approveInOrder:
          description: "If true, the approvers array index is their approval order"
          type: boolean
        thirdPartySignature:
          description: True if the signature is made by a third party
          type: boolean
        signatureAcceptAttachments:
          description: True if attachments are accepted
          type: boolean
        requestedAttachments:
          description: List of requested signature attachments
          type: array
          items:
            $ref: '#/components/schemas/RequestedSignatureAttachment'
        withLink:
          description: True if link are returned
          type: boolean
        omitirNotificacion:
          description: True if notification off
          type: boolean
        postMessage:
          description: True if post a windows message in cliente side
          type: boolean
      deprecated: true
    SignatureRequestDocument:
      required:
      - signatureType
      - recipients
      type: object
      properties:
        fileUUID:
          description: UUID of the uploaded PDF to /v1/files/tmp/upload
          type: string
          example: 46d3d6bc-2ec2-4e02-ab32-9d56d6ddc5c8
        file:
          description: Base64 content file
          type: object
          allOf:
          - $ref: '#/components/schemas/SgUploadFile64'
          example: '...'
        template:
          description: Template code
          type: string
          example: 276e4a58-bafd-44b9-a78f-9c2cac055731
        dataForm:
          description: Data to be mapped to the template
          type: array
          items:
            $ref: '#/components/schemas/DataForm'
        formCustomTags:
          description: Data to be written in pdf
          type: array
          items:
            $ref: '#/components/schemas/FormCustomTag'
        docOriginId:
          description: Unique ID of the signature request for the document in the
            origin application. This ID cannot be the same for different signature
            requests.
          type: string
        fileName:
          description: Name of the file with extension
          type: string
          example: Document.pdf
        signatureType:
          description: Signature type
          enum:
          - Advanced
          - Simple
          type: string
          example: Simple
        signatureSubType:
          description: Signature sub-type
          enum:
          - Advanced
          - Simple
          - Biometric
          type: string
          example: Biometric
        recipients:
          description: List of recipients
          type: array
          items:
            $ref: '#/components/schemas/Recipient'
        attachmentFileUUID:
          description: UUID of the uploaded file to /v1/files/tmp/upload
          type: string
          example: 46d3d6bc-2ec2-4e02-ab32-9d56d6ddc5c8
        attachmentFileName:
          description: Name of the file with extension
          type: string
          example: inbox.xml | inbox.zip
        customTags:
          description: Document tags
          type: array
          items:
            $ref: '#/components/schemas/SgTagApp'
        docTagId:
          description: Document tag ID
          type: string
    SignatureRequestMultiple:
      description: Signature request for multiple documents
      required:
      - emailSubject
      - documents
      type: object
      properties:
        emailMessage:
          description: Additional body of email sent to recipients.
          type: string
        emailSubject:
          description: Subject of email sent to recipients
          type: string
          example: Signature Request
        solDiasNotificacion:
          format: int32
          description: Pending days to notify
          type: integer
          example: 1
        callbackUrl:
          description: POST callback url invoked by VaFirma after all recipients signing
            is complete. VaFirma docUUID and docOriginId (if present) will be sent
            in body.
          maxLength: 1024
          type: string
        approvers:
          description: Use recipients on each document with signerParticipantType
            = 'APROBACION'
          type: array
          items:
            $ref: '#/components/schemas/Approver'
          deprecated: true
        approveInOrder:
          description: "If true, the approvers array index is their approval order"
          type: boolean
        thirdPartySignature:
          description: True if the signature is made by a third party
          type: boolean
        signatureAcceptAttachments:
          description: True if attachments are accepted
          type: boolean
        requestedAttachments:
          description: Requested signature attachments
          type: array
          items:
            $ref: '#/components/schemas/RequestedSignatureAttachment'
        documents:
          description: List of requested signature documents
          type: array
          items:
            $ref: '#/components/schemas/SignatureRequestDocument'
        withLink:
          description: True if link are returned
          type: boolean
        omitirNotificacion:
          description: "True if notification off (use: disabledNotification)"
          type: boolean
          deprecated: true
        disabledNotification:
          description: True if notification is off
          type: boolean
        postMessage:
          description: True if post a windows message in cliente side
          type: boolean
        clientId:
          description: ID of the client that initiates the creation of the request
          maxLength: 255
          type: string
        operationId:
          description: ID of the external operation that initiates the creation of
            the request
          maxLength: 255
          type: string
        bioCallbackUrl:
          description: POST callback url invoked by VaFirma after biometric is complete.
            VaFirma bioUUID and bioOriginId (if present) will be sent in body.
          maxLength: 1024
          type: string
    UanatacaEventType:
      enum:
      - REQUEST_CREATED
      - REQUEST_CANCELED
      - REQUEST_APPROVED
      - REQUEST_ENROLLED
      - CERTIFICATE_SUSPENDED
      - CERTIFICATE_ACTIVATED
      - CERTIFICATE_REVOKED
      - VIDEOID_UPDATED
      - VIDEOID_FAILED
      - VIDEOID_REFUSED
      - VIDEOID_VALIDATED
      - SIGNED
      type: string
    UanatacaRequestStatus:
      enum:
      - success
      - error
      - CREATED
      - CANCELLED
      - ENROLLREADY
      - ISSUED
      - VALID
      - SUSPENDED
      - REVOKED
      - VIDEOPENDING
      - VIDEOINCOMPLETE
      - VIDEOERROR
      - ERROR
      - VIDEOREVIEW
      - FINISHED
      - DOCUPLOADED
      - OTPGENERATED
      - VALIDATED
      - APPROVED
      - SIGNED
      type: string
    UanatacaUploadDetail:
      description: Detalle de archivo subido o con error
      type: object
      properties:
        name:
          description: Nombre del campo
          type: string
          example: file
        uid:
          description: Identificador único del archivo
          type: string
        errorCode:
          description: Código de error si la carga falló
          type: string
        errorMessage:
          description: Mensaje de error asociado
          type: string
    UanatacaVideoIdEventDto:
      description: Evento de validación de VideoID
      required:
      - event_type
      - sent_at
      - request
      type: object
      properties:
        event_type:
          description: Tipo de evento
          type: string
          allOf:
          - $ref: '#/components/schemas/UanatacaEventType'
          example: VIDEOID_VALIDATED
        sent_at:
          description: Fecha/hora de envío en formato yyyyMMddHHmmss
          type: string
          example: "20251001201659"
        request:
          description: Detalle de la request asociada al evento
          type: object
          allOf:
          - $ref: '#/components/schemas/UanatacaVideoIdRequestDto'
        certificates:
          description: Lista de certificados asociados
          type: array
          items:
            type: object
    UanatacaVideoIdRequestDto:
      description: Detalle de la request de VideoID
      type: object
      properties:
        status:
          description: Estado actual de la solicitud
          type: string
          allOf:
          - $ref: '#/components/schemas/UanatacaRequestStatus'
          example: CREATED
        profile:
          description: Perfil asociado a la solicitud
          type: string
          example: PFnubeSOSCiudadano
        registration_authority:
          format: int32
          description: Autoridad de registro
          type: integer
        previous_status:
          description: Estado previo
          type: string
          example: VIDEOREVIEW
        pk:
          description: Identificador primario de la solicitud
          type: string
        scratchcard:
          description: Número de scratchcard
          type: string
        detail:
          description: Detalle de archivos subidos
          type: array
          items:
            $ref: '#/components/schemas/UanatacaUploadDetail'
        message:
          description: Mensaje asociado
          type: string
        certificates:
          description: Lista de certificados asociados
          type: array
          items:
            $ref: '#/components/schemas/CertificateDTO'
        videoid_pk:
          description: Data
          type: string
        videoid_link:
          description: Data
          type: string
        qrCode:
          description: Data
          type: string
        redirect:
          description: Data
          type: string
    UanatacaVideoIdResponseDto:
      description: Detalle de la request de VideoID
      type: object
      properties:
        status:
          description: Estado actual de la solicitud
          type: string
          allOf:
          - $ref: '#/components/schemas/UanatacaRequestStatus'
          example: CREATED
        pk:
          description: Identificador primario de la solicitud
          type: string
        message:
          description: Mensaje asociado
          type: string
        videoid_link:
          description: Data
          type: string
        qrCode:
          description: Data
          type: string
        redirect:
          description: Data
          type: string
    UanatacaVideoIdSignatureAppearance:
      description: Opciones visuales para la firma
      type: object
      properties:
        text:
          description: "Texto que aparecerá en la firma, con variables"
          type: array
          items:
            type: string
          example:
          - "Firmado por: %(CN)s"
        date:
          description: Formato de fecha
          type: string
          example: '%d/%m/%Y %H:%M:%S %z'
        timezone:
          description: Zona horaria utilizada para la firma
          type: string
          example: Europe/Madrid
        position:
          description: "Posición en el documento (x1,y1,x2,y2)"
          type: string
          example: "30, 100, 165, 150"
        horizontal:
          description: Indica si la orientación es horizontal
          type: boolean
          example: true
        image:
          description: ID de la imagen utilizada como sello
          type: string
          example: be1cd133-8be5-4346-87de-d40afd9309
        page:
          format: int32
          description: Número de página donde aplicar la firma
          type: integer
          example: 0
    UanatacaVideoIdSignatureDto:
      description: Información de la firma
      required:
      - appearance
      type: object
      properties:
        appearance:
          description: Configuración de la apariencia de la firma
          type: object
          allOf:
          - $ref: '#/components/schemas/UanatacaVideoIdSignatureAppearance'
    UanatacaVideoIdSignatureRequest:
      description: Petición de firma con opciones de apariencia
      required:
      - secret
      - signature
      type: object
      properties:
        secret:
          description: Secreto u OTP para autorizar la firma
          type: string
          example: "123456"
        signature:
          description: Configuración de la firma
          type: object
          allOf:
          - $ref: '#/components/schemas/UanatacaVideoIdSignatureDto'
  securitySchemes:
    SecurityScheme:
      type: http
      description: Authentication
      scheme: basic
