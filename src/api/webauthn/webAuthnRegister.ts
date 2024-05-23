import { arrayBufferToBase64 } from '../../lib/arrayBufferToBase64';
import { utf8StringToArrayBuffer } from '../../lib/utf8StringToArrayBuffer';

type RegistrationResult =
  | 'fail_create_credential'
  | 'success'
  | 'failed';

export const webAuthnRegister = async (
  signal: AbortSignal,
): Promise<RegistrationResult> => {
  const preregistrationResponse = await fetch(
    'http://localhost:8080/webauthn/credential_creation_options',
    {
      method: 'GET'
    },
  );

  const options = await preregistrationResponse.json();
  options.publicKey.rp.id = undefined;
  options.publicKey.user.id = utf8StringToArrayBuffer(
    options.publicKey.user.id,
  );
  options.publicKey.challenge = utf8StringToArrayBuffer(
    options.publicKey.challenge,
  );
  if (options.publicKey.excludeCredentials) {
    for (let cred of options.publicKey.excludeCredentials) {
      cred.id = utf8StringToArrayBuffer(cred.id);
    }
  }
  options.signal = signal;

  console.log(
    `PublicKeyCredentialCreationOption:\n${JSON.stringify(
      options,
      null,
      '\t',
    )}`,
  );

  const credential = await navigator.credentials
    .create(options)
    .then((credential) => {
      return credential as PublicKeyCredential;
    })
    .catch((err) => {
      console.log('ERROR', err);
      return undefined;
    });
  if (credential === undefined) {
    return 'fail_create_credential';
  }

  const authenticatorAttestationResponse =
    credential.response as AuthenticatorAttestationResponse;

  const registrationResponse = await fetch(
    'http://localhost:8080/webauthn/registration',
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: credential.type,
        id: credential.id,
        rawId: arrayBufferToBase64(credential.rawId),
        clientDataJSON: arrayBufferToBase64(
          authenticatorAttestationResponse.clientDataJSON,
        ),
        attestationObject: arrayBufferToBase64(
          authenticatorAttestationResponse.attestationObject,
        ),
        transports: authenticatorAttestationResponse.getTransports(),
      }),
    },
  );

  if (!registrationResponse.ok) {
    return 'failed';
  }

  return 'success';
};
